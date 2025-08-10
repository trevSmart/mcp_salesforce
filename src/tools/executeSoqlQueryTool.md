
# 🔄 Execute SOQL Query

Allows you to run SOQL queries in Salesforce using the CLI.

---

## 🧠 Agent Instructions

### 📌 Required Fields
- ⚠️ **IMPORTANT**: Always retrieve the following:
  - The `Id` field of the object
  - The `Name` field of the main object
  - The `Name` field of any related objects
    *(Note: the `Case` object does not have a `Name` field — use `CaseNumber` instead)*

### Example

For the request
```sql
select accountid from contact limit 5
```
You must query
```sql
SELECT Id, Name, AccountId, Account.Name FROM Contact LIMIT 5
```
---

### 🔧 Parameters
- Pass the SOQL query using the `query` parameter.
- If you want to use the Tooling API, include this:
  ```json
  { "useToolingApi": true }
  ```

---

### 🖼️ Output Format

- Display results as a **table**, with one row per record.
- 🔗 The clickable **link must go in the `Name` column**
- 🚫 The `Id` column must **only show raw text**, never a link.

#### ⚠️ Summary:
- ✅ `Name` → clickable link
- ✅ Related object `Name` fields (e.g., `Account.Name`) → clickable link
- ❌ `Id` → raw ID only, **no link**

---

### ❌ Incorrect Example

| Id           | Name                        |
|--------------|-----------------------------|
| [003KN...](url) | MARC LAGUNA SANTOS        |

### ✅ Correct Example

| Id           | Name                          |
|--------------|-------------------------------|
| 003KN...      | [MARC LAGUNA SANTOS](url)    |

---

## 🧪 Usage Examples

### ▶️ Example 1 — `SELECT Id FROM Account`
```json
{
  "query": "SELECT Id, Name FROM Account"
}
```

#### Output:

| Id  | Name             |
|-----|------------------|
| a01 | [Account 1](...) |
| a02 | [Account 2](...) |

---

### ▶️ Example 2 — Query with Related Fields
```json
{
  "query": "SELECT Name, AccountId, Account.Name, CreatedById, CreatedBy.Name FROM Contact"
}
```

#### Output:

| Id  | Name             | AccountId | Account.Name        | CreatedById | CreatedBy.Name       |
|-----|------------------|-----------|----------------------|-------------|-----------------------|
| c01 | [James Doe](...) | a01       | [Account 1](...)     | u01         | [John Doe](...)       |
| c02 | [Jane Doe](...)  | a02       | [Account 2](...)     | u02         | [Jane Doe](...)       |

---

### ▶️ Example 3 — Using Tooling API
```json
{
  "query": "SELECT Id, Name, CreatedById, CreatedById.Name FROM ApexClass",
  "useToolingApi": true
}
```

#### Output:

| Id  | Name               | CreatedById | CreatedBy.Name       |
|-----|--------------------|-------------|-----------------------|
| 001 | [ApexClass 1](...) | u01         | [John Doe](...)       |
| 002 | [ApexClass 2](...) | u02         | [Jane Doe](...)       |

---

If you’d like, I can also help you generate this as a `.md` file or include it in your `mcp.json` configuration.
