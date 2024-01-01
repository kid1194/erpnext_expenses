# ERPNext Expenses

An expenses management module for ERPNext.

⚠️ **This plugin is in ALPHA stage so it is not PRODUCTION ready.** ⚠️

---

### Contributors
**The list of people who deserves more than a simple "Thank You".**
- [Monolith Online](https://github.com/monolithon) {Test} {Debug} ♥
- [Andrew Rogers](https://github.com/agrogers) {Test} {Debug} 👍
- [washaqq](https://github.com/washaqq) {Test} {Debug} 👍
- [codi](https://github.com/hassan-youssef) {Debug} 👍

---

### Table of Contents
- [Requirements](#requirements)
- [Setup](#setup)
  - [Install](#install)
  - [Update](#update)
  - [Uninstall](#uninstall)
- [Usage](#usage)
- [Issues](#issues)
- [License](#license)

---

### Requirements
- Frappe >= v13.0.0
- ERPNext >= v13.0.0

---

### Setup

⚠️ **Important** ⚠️

*Do not forget to replace "[sitename]" with the name of your site in all commands.*

#### Install
1. Go to bench directory

```
cd ~/frappe-bench
```

2. Get plugin from Github

*(Required only once)*

```
bench get-app https://github.com/kid1194/erpnext_expenses
```

3. Install plugin on your site

```
bench --site [sitename] install-app expenses
```

4. Read the [Usage](#usage) section below

#### Update
1. Go to app directory

```
cd ~/frappe-bench/apps/expenses
```

2. Get updates from Github

```
git pull
```

3. Go to bench directory

```
cd ~/frappe-bench
```

4. Update your site

```
bench --site [sitename] migrate
```

5. (Optional) Restart bench

```
bench restart
```

#### Uninstall
1. Go to bench directory

```
cd ~/frappe-bench
```

2. Uninstall plugin from your site

```
bench --site [sitename] uninstall-app expenses
```

3. (Optional) Remove plugin from bench

```
bench remove-app expenses
```

4. (Optional) Restart bench

```
bench restart
```

---

### Usage
1. **Expense Type**
  - Create the hierarchy of expense types based on your needs
  - Under each type, add the expense account for each company

ℹ️ *Note: The expense accounts are inherited from parents if not set*

ℹ️ *Note: Child expense types will be required to add expense accounts unless is already set in parent type or in one of its ancestors*

2. **Expense Item**
  - Create the expense items that reflect your expenses
  - Add each expense item to the expense type that it belongs to
  - Change the expense account for each company and/or set the expense defaults (cost, quantity, etc..)

ℹ️ *Note: The expense accounts are inherited from expense types if not changed*

3. **Expense**
  - Create a company expense and fill the cost, quantity, etc..
  - Attachments can be added or removed even after submit, but before adding the expense to an expenses request

4. **Expenses Request**
  - Create a request for a company list of expenses so that it can be approved or rejected
  - When requests are rejected, the linked expenses will be automatically rejected & cancelled
  - Rejected requests can be appealed and after appealing, the status of linked expenses will be automatically restored and set as Requested

5. **Expenses Entry**
  - Create entries based on a request or manually add company related expenses
  - After submit, all the expenses will be posted to the journal

6. **Expenses Settings**
  - Enable the module (Enabled by default)
  - Modify the update notification settings
  - Check for update manually

ℹ️ *Note: Plugin update functionality will only be enabled in the PRODUCTION stage*

---

### Issues
If you find bug in the plugin, please create a [bug report](https://github.com/kid1194/erpnext_expenses/issues/new?assignees=&labels=&template=bug_report.md&title=) and let us know about it.

---

### License
This repository has been released under the [MIT License](https://github.com/kid1194/erpnext_expenses/blob/main/LICENSE).