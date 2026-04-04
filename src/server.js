const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');
const csrfMiddleware = require('./middleware/csrf');
const { router: authRouter, getAppleConfig } = require('./routes/auth');

const crypto = require('crypto');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('ERROR: SESSION_SECRET environment variable must be set in production');
  process.exit(1);
}

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const app = express();

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method override for PUT/DELETE via forms
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Flash
app.use(flash());

// CSRF protection (must come after session and body parsing)
app.use(csrfMiddleware);

// Template renderer
function renderTemplate(res, templateName, data = {}) {
  const templatePath = path.join(__dirname, 'views', templateName);
  let html = fs.readFileSync(templatePath, 'utf8');

  // Replace {{key}} placeholders
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regex, value != null ? value : '');
  }

  // Handle {{#if key}}...{{/if}} conditionals (supports nesting by resolving innermost pairs first)
  // The regex matches {{#if X}}...{{/if}} blocks whose body does NOT contain another {{#if,
  // so nested structures are resolved from the inside out across iterations.
  let prev;
  let maxIter = 50;
  do {
    prev = html;
    html = html.replace(/\{\{#if (\w+)\}\}((?:(?!\{\{#if )[\s\S])*?)\{\{\/if\}\}/g, (_, key, content) => {
      return data[key] ? content : '';
    });
  } while (html !== prev && --maxIter > 0);

  // Clear any remaining placeholders
  html = html.replace(/\{\{[^}]+\}\}/g, '');

  res.send(html);
}

function hasContent(value) {
  return value != null && String(value).trim() !== '';
}

function getPermissionSet(roleName) {
  if (!roleName) {
    return new Set();
  }

  const db = require('./config/database');
  const permRows = db.prepare(`
    SELECT p.name FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN roles r ON r.id = rp.role_id
    WHERE r.name = ?
  `).all(roleName);

  return new Set(permRows.map((permission) => permission.name));
}

function getSectionStatusMeta(isComplete, completeDetail, incompleteDetail) {
  return {
    statusClass: isComplete ? 'status-pill-complete' : 'status-pill-incomplete',
    statusText: isComplete ? 'Complete' : 'Needs attention',
    detail: isComplete ? completeDetail : incompleteDetail
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
}

function buildSubmittedRepeatableEntries(body, idFieldName, valueFieldName, validItems, outputIdKey) {
  const validTypeIds = new Set(validItems.map((item) => String(item.id)));
  const typeIds = normalizeArray(body[idFieldName]);
  const values = normalizeArray(body[valueFieldName]);
  const entryCount = Math.max(typeIds.length, values.length);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    const typeId = String(typeIds[index] || '').trim();
    const value = String(values[index] || '').trim();

    if (!typeId || !validTypeIds.has(typeId) || !value) {
      continue;
    }

    entries.push({
      [outputIdKey]: Number(typeId),
      value
    });
  }

  return entries;
}

function renderRepeatableTypeOptions(items, selectedItemId) {
  return items.map((item) => {
    const isSelected = String(item.id) === String(selectedItemId);
    return `<option value="${item.id}" data-placeholder="${escHtml(item.placeholder || '')}" ${isSelected ? 'selected' : ''}>${escHtml(item.name)}</option>`;
  }).join('');
}

function renderRepeatableEntriesManager(config) {
  const {
    items,
    entries,
    managerKind,
    typeLabel,
    valueLabel,
    typeInputName,
    valueInputName,
    copyText,
    emptyText,
    addButtonText,
    disabledText,
    removeMessage,
    enableReorder,
    itemIdKey
  } = config;

  if (items.length === 0) {
    return `
      <div class="repeatable-manager repeatable-manager-disabled">
        <p class="hint">${escHtml(disabledText)}</p>
      </div>`;
  }

  const renderEntry = (entry) => {
    const selectedItem = items.find((item) => String(item.id) === String(entry[itemIdKey])) || items[0];
    return `
      <div class="repeatable-entry" data-repeatable-entry draggable="${enableReorder ? 'true' : 'false'}">
        <div class="repeatable-entry-grid">
          <div class="form-group">
            <label>${escHtml(typeLabel)}</label>
            <select name="${typeInputName}[]" class="form-control" data-repeatable-type>
              ${renderRepeatableTypeOptions(items, selectedItem.id)}
            </select>
          </div>
          <div class="form-group">
            <label>${escHtml(valueLabel)}</label>
            <input type="text" name="${valueInputName}[]" class="form-control"
                   value="${escHtml(entry.value || '')}" placeholder="${escHtml(selectedItem.placeholder || '')}" data-repeatable-value>
          </div>
        </div>
        <div class="repeatable-entry-actions">
          ${enableReorder ? '<span class="reorder-handle" data-repeatable-handle>Drag to reorder</span>' : ''}
          <button type="button" class="btn btn-danger btn-sm" data-repeatable-remove>Remove</button>
        </div>
      </div>`;
  };

  const firstItem = items[0];
  const rowsHtml = entries.map(renderEntry).join('');

  return `
    <div class="repeatable-manager" data-repeatable-manager data-entry-kind="${escHtml(managerKind)}" data-remove-message="${escHtml(removeMessage)}" data-enable-reorder="${enableReorder ? 'true' : 'false'}">
      <div class="repeatable-toolbar">
        <div>
          <p class="repeatable-copy">${escHtml(copyText)}</p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-repeatable-add>${escHtml(addButtonText)}</button>
      </div>
      <div class="repeatable-list" data-repeatable-list>
        <div class="repeatable-empty" data-repeatable-empty ${rowsHtml ? 'style="display:none"' : ''}>${escHtml(emptyText)}</div>
        ${rowsHtml}
      </div>
      <template data-repeatable-template>
        <div class="repeatable-entry" data-repeatable-entry draggable="${enableReorder ? 'true' : 'false'}">
          <div class="repeatable-entry-grid">
            <div class="form-group">
              <label>${escHtml(typeLabel)}</label>
              <select name="${typeInputName}[]" class="form-control" data-repeatable-type>
                ${renderRepeatableTypeOptions(items, firstItem.id)}
              </select>
            </div>
            <div class="form-group">
              <label>${escHtml(valueLabel)}</label>
              <input type="text" name="${valueInputName}[]" class="form-control"
                     value="" placeholder="${escHtml(firstItem.placeholder || '')}" data-repeatable-value>
            </div>
          </div>
          <div class="repeatable-entry-actions">
            ${enableReorder ? '<span class="reorder-handle" data-repeatable-handle>Drag to reorder</span>' : ''}
            <button type="button" class="btn btn-danger btn-sm" data-repeatable-remove>Remove</button>
          </div>
        </div>
      </template>
    </div>`;
}

function buildProfileSectionState(user, roleName) {
  const ProfileFieldType = require('./models/profile_field_type');
  const SocialPlatform = require('./models/social_platform');
  const ConnectedAccountType = require('./models/connected_account_type');
  const visibleSections = getRoleSectionVisibility(roleName);
  const accountComplete = hasContent(user?.username) && hasContent(user?.email);
  const accountStatus = getSectionStatusMeta(
    accountComplete,
    'Username and email are set.',
    'Add both a username and an email address.'
  );

  const sectionState = {
    account: {
      label: 'Account',
      complete: accountComplete,
      ...accountStatus
    },
    personalInfo: {
      label: 'Personal Information',
      visible: visibleSections.show_personal_info,
      complete: true,
      statusClass: 'status-pill-complete',
      statusText: 'Complete',
      detail: 'Personal information is ready.'
    },
    socialMedia: {
      label: 'Social Media',
      visible: visibleSections.show_social_media,
      complete: true,
      statusClass: 'status-pill-complete',
      statusText: 'Complete',
      detail: 'Social media links are ready.'
    },
    connectedAccounts: {
      label: 'Connected Accounts',
      visible: visibleSections.show_connected_accounts,
      complete: true,
      statusClass: 'status-pill-complete',
      statusText: 'Complete',
      detail: 'Connected accounts are ready.'
    }
  };

  if (visibleSections.show_personal_info) {
    const fieldTypes = ProfileFieldType.findAll();
    const fieldValues = ProfileFieldType.getUserProfileFields(user.id);
    const fieldMap = new Map(fieldValues.map((field) => [field.field_type_id, field.value]));
    const anyPersonalValue = fieldTypes.some((field) => hasContent(fieldMap.get(field.id)));
    const requiredFieldsComplete = fieldTypes.every((field) => !field.is_mandatory || hasContent(fieldMap.get(field.id)));
    const personalComplete = fieldTypes.length === 0 || (anyPersonalValue && requiredFieldsComplete);
    const mandatoryCount = fieldTypes.filter((field) => field.is_mandatory).length;

    sectionState.personalInfo = {
      label: 'Personal Information',
      visible: true,
      complete: personalComplete,
      ...getSectionStatusMeta(
        personalComplete,
        fieldTypes.length === 0
          ? 'No personal info fields are configured.'
          : 'Personal information is filled for this role.',
        mandatoryCount > 0
          ? 'Fill the required fields and add at least one detail.'
          : 'Add at least one personal detail.'
      )
    };
  }

  if (visibleSections.show_social_media) {
    const platforms = SocialPlatform.findAll();
    const links = SocialPlatform.getUserSocialLinks(user.id);
    const socialComplete = platforms.length === 0 || links.some((link) => hasContent(link.value));

    sectionState.socialMedia = {
      label: 'Social Media',
      visible: true,
      complete: socialComplete,
      ...getSectionStatusMeta(
        socialComplete,
        platforms.length === 0
          ? 'No social media platforms are configured.'
          : 'At least one social profile is connected.',
        'Add at least one social profile link.'
      )
    };
  }

  if (visibleSections.show_connected_accounts) {
    const accountTypes = ConnectedAccountType.findAll();
    const accounts = ConnectedAccountType.getUserConnectedAccounts(user.id);
    const connectedComplete = accountTypes.length === 0 || accounts.some((account) => hasContent(account.value));

    sectionState.connectedAccounts = {
      label: 'Connected Accounts',
      visible: true,
      complete: connectedComplete,
      ...getSectionStatusMeta(
        connectedComplete,
        accountTypes.length === 0
          ? 'No connected account types are configured.'
          : 'At least one external account is linked.',
        'Connect at least one external account.'
      )
    };
  }

  const visibleSectionList = [
    sectionState.account,
    sectionState.personalInfo.visible ? sectionState.personalInfo : null,
    sectionState.socialMedia.visible ? sectionState.socialMedia : null,
    sectionState.connectedAccounts.visible ? sectionState.connectedAccounts : null
  ].filter(Boolean);
  const completedSections = visibleSectionList.filter((section) => section.complete).length;
  const completionPercent = visibleSectionList.length === 0
    ? 100
    : Math.round((completedSections / visibleSectionList.length) * 100);

  return {
    ...sectionState,
    visibleSectionList,
    completedSections,
    completionPercent
  };
}

function buildDashboardProfileCompletion(currentUser, roleName) {
  const sectionState = buildProfileSectionState(currentUser, roleName);
  const missingSections = sectionState.visibleSectionList.filter((section) => !section.complete);
  const missingSectionsHtml = missingSections.length > 0
    ? missingSections.map((section) => `
        <li class="completion-list-item">
          <strong>${escHtml(section.label)}</strong>
          <span>${escHtml(section.detail)}</span>
        </li>`).join('')
    : `
        <li class="completion-list-item completion-list-item-complete">
          <strong>All visible sections are complete.</strong>
          <span>Your profile is ready to go.</span>
        </li>`;

  return {
    profile_completion_percent: sectionState.completionPercent,
    profile_completion_angle: Math.round((sectionState.completionPercent / 100) * 360),
    profile_completion_summary: `${sectionState.completedSections} of ${sectionState.visibleSectionList.length} sections complete`,
    profile_missing_sections_html: missingSectionsHtml
  };
}

function pathMatches(currentPath, targetRoot) {
  return currentPath === targetRoot || currentPath.startsWith(`${targetRoot}/`);
}

// Attach renderTemplate to res
app.use((req, res, next) => {
  res.renderTemplate = (templateName, data) => {
    const currentPath = req.path || '';
    const usersActive = pathMatches(currentPath, '/users');
    const rolesActive = pathMatches(currentPath, '/roles');
    const profileFieldsActive = pathMatches(currentPath, '/profile-fields');
    const socialPlatformsActive = pathMatches(currentPath, '/social-platforms');
    const connectedAccountsActive = pathMatches(currentPath, '/connected-accounts');
    const profileActive = pathMatches(currentPath, '/profile');

    const base = {
      csrf_token: res.locals.csrfToken || '',
      is_admin: req.session && req.session.role === 'admin' ? true : false,
      current_user_id: (req.session && req.session.userId) || '',
      nav_admin_active_class: (usersActive || rolesActive) ? 'navbar-menu-group-active' : '',
      nav_configuration_active_class: (profileFieldsActive || socialPlatformsActive || connectedAccountsActive) ? 'navbar-menu-group-active' : '',
      nav_users_active_class: usersActive ? 'navbar-link-active' : '',
      nav_roles_active_class: rolesActive ? 'navbar-link-active' : '',
      nav_profile_fields_active_class: profileFieldsActive ? 'navbar-link-active' : '',
      nav_social_platforms_active_class: socialPlatformsActive ? 'navbar-link-active' : '',
      nav_connected_accounts_active_class: connectedAccountsActive ? 'navbar-link-active' : '',
      nav_profile_active_class: profileActive ? 'navbar-user-link-active' : ''
    };
    // Inject permission flags and section visibility for current user
    if (req.session && req.session.role) {
      const _db = require('./config/database');
      const permSet = getPermissionSet(req.session.role);
      base.can_manage_profile_fields    = (base.is_admin || permSet.has('manage_profile_fields')) ? true : false;
      base.can_manage_social_platforms  = (base.is_admin || permSet.has('manage_social_platforms')) ? true : false;
      base.can_manage_connected_accounts = (base.is_admin || permSet.has('manage_connected_accounts')) ? true : false;
      base.has_configuration_menu = (base.can_manage_profile_fields || base.can_manage_social_platforms || base.can_manage_connected_accounts) ? true : false;
      const roleRow = _db.prepare('SELECT show_personal_info, show_social_media, show_connected_accounts FROM roles WHERE name = ?').get(req.session.role);
      if (roleRow) {
        base.show_personal_info      = roleRow.show_personal_info      ? true : false;
        base.show_social_media       = roleRow.show_social_media       ? true : false;
        base.show_connected_accounts = roleRow.show_connected_accounts ? true : false;
      }
    }
    const merged = Object.assign(base, data);
    return renderTemplate(res, templateName, merged);
  };
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const User = require('./models/user');
  const Role = require('./models/role');
  const ProfileFieldType = require('./models/profile_field_type');
  const SocialPlatform = require('./models/social_platform');
  const ConnectedAccountType = require('./models/connected_account_type');
  const db = require('./config/database');
  const currentUser = User.findById(req.session.userId);
  const isAdmin = req.session.role === 'admin';
  const profileCompletion = currentUser
    ? buildDashboardProfileCompletion(currentUser, req.session.role)
    : {
        profile_completion_percent: 0,
        profile_completion_angle: 0,
        profile_completion_summary: '0 of 0 sections complete',
        profile_missing_sections_html: ''
      };
  const totalUsers = User.count();
  const allRoles = Role.findAll();
  const roleDistributionHtml = db.prepare(`
    SELECT r.name, COUNT(u.id) AS user_count
    FROM roles r
    LEFT JOIN users u ON u.role = r.name
    GROUP BY r.id, r.name
    ORDER BY user_count DESC, r.name ASC
  `).all().map((role) => `
    <li class="metric-list-item">
      <span>${escHtml(role.name)}</span>
      <strong>${role.user_count} users</strong>
    </li>`).join('');

  const canManageUsers = isAdmin;
  const canManageRoles = isAdmin;
  const hasAdminTools = canManageUsers || canManageRoles;
  const permissionSet = getPermissionSet(req.session.role);
  const canManageProfileFields = isAdmin || permissionSet.has('manage_profile_fields');
  const canManageSocialPlatforms = isAdmin || permissionSet.has('manage_social_platforms');
  const canManageConnectedAccounts = isAdmin || permissionSet.has('manage_connected_accounts');
  const hasFeatureTools = canManageProfileFields || canManageSocialPlatforms || canManageConnectedAccounts;

  res.renderTemplate('dashboard.html', {
    username: req.session.username,
    total_users: totalUsers,
    total_roles: allRoles.length,
    role_distribution_html: roleDistributionHtml,
    can_manage_users: canManageUsers ? 'yes' : '',
    can_manage_roles: canManageRoles ? 'yes' : '',
    has_admin_tools: hasAdminTools ? 'yes' : '',
    has_feature_tools: hasFeatureTools ? 'yes' : '',
    profile_field_count: ProfileFieldType.findAll().length,
    social_platform_count: SocialPlatform.findAll().length,
    connected_account_count: ConnectedAccountType.findAll().length,
    ...profileCompletion,
    apple_configured: getAppleConfig().isConfigured ? 'yes' : '',
    apple_connected: currentUser && currentUser.apple_sub ? 'yes' : '',
    apple_connected_at: currentUser && currentUser.apple_connected_at
      ? new Date(currentUser.apple_connected_at).toLocaleString()
      : '',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' ')
  });
});

app.use('/', authRouter);
app.use('/users', require('./routes/users'));
app.use('/roles', require('./routes/roles'));
app.use('/settings', require('./routes/settings'));
app.use('/social-platforms', require('./routes/social_platforms'));
app.use('/connected-accounts', require('./routes/connected_accounts'));
app.use('/profile-fields', require('./routes/profile_fields'));

function getRoleSectionVisibility(roleName) {
  const _db = require('./config/database');
  const role = _db.prepare('SELECT show_personal_info, show_social_media, show_connected_accounts FROM roles WHERE name = ?').get(roleName || '');
  return {
    show_personal_info:      role ? !!role.show_personal_info      : true,
    show_social_media:       role ? !!role.show_social_media       : true,
    show_connected_accounts: role ? !!role.show_connected_accounts : true
  };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/profile', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const User = require('./models/user');
  const SocialPlatform = require('./models/social_platform');
  const ConnectedAccountType = require('./models/connected_account_type');
  const ProfileFieldType = require('./models/profile_field_type');
  const user = User.findById(req.session.userId);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/dashboard');
  }

  const sections = getRoleSectionVisibility(req.session.role);
  const profileSectionState = buildProfileSectionState(user, req.session.role);

  // Dynamic personal info fields (only if visible for this role)
  let personalInfoFields = '';
  if (sections.show_personal_info) {
    const profileFieldTypes = ProfileFieldType.findAll();
    const profileFieldRows = ProfileFieldType.getUserProfileFields(req.session.userId);
    const profileFieldMap = {};
    for (const row of profileFieldRows) profileFieldMap[row.field_type_id] = row.value;
    personalInfoFields = profileFieldTypes.map(f => {
      const required = f.is_mandatory ? ' required' : '';
      const reqLabel = f.is_mandatory ? ' <span style="color:#e94560">*</span>' : '';
      return `
    <div class="form-group">
      <label for="profile_field_${f.id}">${escHtml(f.name)}${reqLabel}</label>
      <input type="${escHtml(f.input_type)}" id="profile_field_${f.id}" name="profile_field_${f.id}" class="form-control"
             value="${escHtml(profileFieldMap[f.id] || '')}" placeholder="${escHtml(f.placeholder)}"${required}>
    </div>`;
    }).join('');
  }

  // Dynamic social links (only if visible for this role)
  let socialFields = '';
  if (sections.show_social_media) {
    const platforms = SocialPlatform.findAll();
    const linkRows = SocialPlatform.getUserSocialLinks(req.session.userId);
    socialFields = renderRepeatableEntriesManager({
      items: platforms,
      entries: linkRows,
      managerKind: 'social-link',
      typeLabel: 'Platform',
      valueLabel: 'Profile Link',
      typeInputName: 'social_platform_id',
      valueInputName: 'social_link_value',
      copyText: 'Add only the social profiles you want to show. You can add the same platform more than once and drag to reorder.',
      emptyText: 'No social media profiles added yet.',
      addButtonText: 'Add Social Profile',
      disabledText: 'No social platforms are configured yet. Ask an administrator to add one first.',
      removeMessage: 'Remove this social profile entry?',
      enableReorder: true,
      itemIdKey: 'platform_id'
    });
  }

  // Dynamic connected accounts (only if visible for this role)
  let connectedAccountFields = '';
  if (sections.show_connected_accounts) {
    const accountTypes = ConnectedAccountType.findAll();
    const accountRows = ConnectedAccountType.getUserConnectedAccounts(req.session.userId);
    connectedAccountFields = renderRepeatableEntriesManager({
      items: accountTypes,
      entries: accountRows,
      managerKind: 'connected-account',
      typeLabel: 'Account Type',
      valueLabel: 'Account Information',
      typeInputName: 'connected_account_type_id',
      valueInputName: 'connected_account_value',
      copyText: 'Add only the connected accounts you want to keep. You can use the same account type more than once and drag to reorder them.',
      emptyText: 'No connected accounts added yet.',
      addButtonText: 'Add Account',
      disabledText: 'No connected account types are configured yet. Ask an administrator to add one first.',
      removeMessage: 'Remove this connected account entry?',
      enableReorder: true,
      itemIdKey: 'account_type_id'
    });
  }

  res.renderTemplate('profile.html', {
    user_username: user.username,
    user_email: user.email,
    user_role: user.role,
    profile_completion_percent: profileSectionState.completionPercent,
    profile_completion_summary: `${profileSectionState.completedSections} of ${profileSectionState.visibleSectionList.length} visible sections complete`,
    account_status_class: profileSectionState.account.statusClass,
    account_status_text: profileSectionState.account.statusText,
    account_status_detail: profileSectionState.account.detail,
    personal_info_status_class: profileSectionState.personalInfo.statusClass,
    personal_info_status_text: profileSectionState.personalInfo.statusText,
    personal_info_status_detail: profileSectionState.personalInfo.detail,
    social_media_status_class: profileSectionState.socialMedia.statusClass,
    social_media_status_text: profileSectionState.socialMedia.statusText,
    social_media_status_detail: profileSectionState.socialMedia.detail,
    connected_accounts_status_class: profileSectionState.connectedAccounts.statusClass,
    connected_accounts_status_text: profileSectionState.connectedAccounts.statusText,
    connected_accounts_status_detail: profileSectionState.connectedAccounts.detail,
    personal_info_fields: personalInfoFields,
    social_links_fields: socialFields,
    connected_accounts_fields: connectedAccountFields,
    member_since: new Date(user.created_at).toLocaleDateString(),
    username: req.session.username,
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' ')
  });
});

app.post('/profile', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const User = require('./models/user');
  const SocialPlatform = require('./models/social_platform');
  const ConnectedAccountType = require('./models/connected_account_type');
  const ProfileFieldType = require('./models/profile_field_type');
  const { username, email, password } = req.body;
  const id = req.session.userId;

  if (!username || !email) {
    req.flash('error', 'Username and email are required');
    return res.redirect('/profile');
  }

  const sections = getRoleSectionVisibility(req.session.role);

  // Validate mandatory personal info fields (only if section is visible)
  const allProfileFieldTypes = ProfileFieldType.findAll();
  if (sections.show_personal_info) {
    for (const f of allProfileFieldTypes) {
      if (f.is_mandatory && !req.body[`profile_field_${f.id}`]) {
        req.flash('error', `"${f.name}" is required`);
        return res.redirect('/profile');
      }
    }
  }

  const existing = User.findById(id);
  if (!existing) {
    req.flash('error', 'User not found');
    return res.redirect('/dashboard');
  }

  const byUsername = User.findByUsername(username);
  if (byUsername && byUsername.id !== id) {
    req.flash('error', 'Username already taken');
    return res.redirect('/profile');
  }

  const byEmail = User.findByEmail(email);
  if (byEmail && byEmail.id !== id) {
    req.flash('error', 'Email already taken');
    return res.redirect('/profile');
  }

  try {
    const updatedUser = User.update(id, { username, email, password: password || null });
    if (updatedUser) {
      req.session.username = updatedUser.username;
    }

    // Save dynamic personal info fields (only if section is visible)
    if (sections.show_personal_info) {
      const profileFields = allProfileFieldTypes.map(f => ({ field_type_id: f.id, value: req.body[`profile_field_${f.id}`] || '' }));
      ProfileFieldType.upsertUserProfileFields(id, profileFields);
    }

    // Save dynamic social links (only if section is visible)
    if (sections.show_social_media) {
      const platforms = SocialPlatform.findAll();
      const links = buildSubmittedRepeatableEntries(req.body, 'social_platform_id', 'social_link_value', platforms, 'platform_id');
      SocialPlatform.replaceUserSocialLinks(id, links);
    }

    // Save dynamic connected accounts (only if section is visible)
    if (sections.show_connected_accounts) {
      const accountTypes = ConnectedAccountType.findAll();
      const accounts = buildSubmittedRepeatableEntries(req.body, 'connected_account_type_id', 'connected_account_value', accountTypes, 'account_type_id');
      ConnectedAccountType.replaceUserConnectedAccounts(id, accounts);
    }

    req.flash('success', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (err) {
    req.flash('error', 'Error updating profile: ' + err.message);
    res.redirect('/profile');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('<h1>404 - Page Not Found</h1><a href="/">Go Home</a>');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('<h1>500 - Internal Server Error</h1>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
