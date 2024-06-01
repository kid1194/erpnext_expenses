# ERPNext Expenses

![v1.0.0-Alpha4](https://img.shields.io/badge/v1.0.0_Alpha4-2024/06/01-blue?style=plastic)

An expenses management module for ERPNext.

⚠️ **This plugin is in ALPHA stage so it is not PRODUCTION ready.** ⚠️

---

### Contributors
**The list of people who deserves more than a simple "Thank You".**
- [![Monolith Online](https://img.shields.io/badge/Monolith_Online-Debug_%7C_Test-red?style=plastic)](https://github.com/monolithon)
- [![Andrew Rogers](https://img.shields.io/badge/Andrew_Rogers-Debug_%7C_Test-blue?style=plastic)](https://github.com/agrogers)
- [![Washaqq](https://img.shields.io/badge/Washaqq-Debug_%7C_Test-orange?style=plastic)](https://github.com/washaqq)
- [![Codi](https://img.shields.io/badge/Codi-Debug_%7C_Test-green?style=plastic)](https://github.com/hassan-youssef)
- [![Ian Kahare](https://img.shields.io/badge/Ian_Kahare-Debug_%7C_Test-yellow?style=plastic)](https://github.com/iakah)

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
- [Frappe](https://github.com/frappe/frappe) >= v13.0.0
- [ERPNext](https://github.com/frappe/erpnext) >= v13.0.0

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

```
bench get-app https://github.com/kid1194/erpnext_expenses
```

3. Build plugin

```
bench build --app expenses
```

4. Install plugin on your site

```
bench --site [sitename] install-app expenses
```

5. Restart bench to clear cache

```
bench restart
```

6. Read the [Usage](#usage) section below

#### Update
1. Go to app directory

```
cd ~/frappe-bench/apps/expenses
```

2. Get updates from Github

```
git pull
```

3. Go to bench directory (Optional)

```
cd ~/frappe-bench
```

4. Build plugin

```
bench build --app expenses
```

5. Update your site

```
bench --site [sitename] migrate
```

5. Restart bench to clear cache

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

3. Remove plugin from bench cache

```
bench remove-app expenses
```

4. Restart bench to clear cache

```
bench restart
```

---

### Usage
1. **Expense Type**
  - Create the hierarchy of expense types based on your needs
  - Add an expense account for each company so it gets inherited by all new expense items

ℹ️ *Note: Expense accounts are inherited from parents.*

2. **Expense Item**
  - Create the expense items that reflect your expenses
  - Add each expense item to the expense type that it belongs to
  - Add an expense account for each company and/or set the expense defaults (cost, quantity, etc..)
  - Modify the expense defaults (cost, quantity, etc..) of the inherited expense accounts, if exist

ℹ️ *Note: Expense accounts will be inherited from linked expense type and they are not modifiable except for cost and quantity related fields.*

3. **Expense**
  - Create a company expense and select the expense item
  - Fill the cost, quantity, etc.. if not fixed for the expense item
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
  - Modify the expense settings
  - Modify the update notification settings
  - Check for update manually

ℹ️ *Note: Module update functionality will only be enabled in the PRODUCTION stage*

---

### Issues
If you find bug in the plugin, please create a [bug report](https://github.com/kid1194/erpnext_expenses/issues/new?assignees=&labels=&template=bug_report.md&title=) and let us know about it.

---

### License
This repository has been released under the [MIT License](https://github.com/kid1194/erpnext_expenses/blob/main/LICENSE).