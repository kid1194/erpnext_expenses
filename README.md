# ERPNext Expenses

An expenses management module for ERPNext.

⚠️ **This plugin is in ALPHA stage so it is not PRODUCTION ready.** ⚠️

---

### Table of Contents
- [Requirements](#requirements)
- [Setup](#setup)
  - [Install](#install)
  - [Update](#update)
  - [Uninstall](#uninstall)
- [Usage](#usage)
- [Issues](#issues)
- [Contributors](#contributors)
- [License](#license)

---

### Requirements
- Frappe >= v14.0.0
- ERPNext >= v14.0.0

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

---

### Issues

---

### Contributors

---

### License
This repository has been released under the [MIT License](https://github.com/kid1194/erpnext_expenses/blob/main/LICENSE).