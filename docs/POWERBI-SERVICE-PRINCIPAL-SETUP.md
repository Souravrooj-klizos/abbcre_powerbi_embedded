# Power BI Service Principal Setup (Fix 500 "An error has occurred")

When **Get Report** or **GenerateToken** returns **500** with `{"Message":"An error has occurred."}`, Power BI is rejecting the Service Principal. Do the steps below in order.

---

## 1. Azure AD: Security group and app membership

Power BI requires the Service Principal to be in a **security group** that you then allow in the tenant setting.

1. In **Azure Portal** → **Microsoft Entra ID** → **Groups** → **New group**  
   - Type: **Security**  
   - Name: e.g. `Power BI API Apps`  
   - Create the group.

2. Add the **Service Principal** (your app) to the group:  
   - Open the new group → **Members** → **Add members**  
   - Search for your **App (application) name** (the one with `AZURE_CLIENT_ID`)  
   - Add it. (You add the "Enterprise application" / service principal, not a user.)

---

## 2. Power BI Admin: Allow service principals

1. Open **Power BI Admin Portal**:  
   - From [app.powerbi.com](https://app.powerbi.com) → **Settings** (gear) → **Admin portal**, or  
   - From **Microsoft 365 admin center** → **Admin centers** → **Power BI**.

2. Go to **Tenant settings**.

3. Find **Developer settings** → **Allow service principals to use Power BI APIs**.

4. Set to **Enabled** and choose **Specific security groups** → add the security group you created (e.g. `Power BI API Apps`).  
   - Save.

Without this, Power BI often returns **500** (or 403) for API calls using a Service Principal.

---

## 3. Workspace: Add Service Principal and use V2

1. **Workspace must be V2 (new workspace)**  
   - In Power BI, create a **new workspace** (not “classic”).  
   - Publish or move your report into this workspace.  
   - Use this workspace’s ID in `POWERBI_WORKSPACE_ID`.

2. **Give the app access to the workspace**  
   - Open the workspace → **Access**  
   - **Add people or groups**  
   - Search for your **application name** (the Azure AD app used as Service Principal)  
   - Role: **Admin** (or at least **Member**)  
   - Add.

---

## 4. Azure AD app: API permissions

In **Azure Portal** → **App registrations** → your app → **API permissions**:

- Add **Power BI Service** (or “Power BI”) with:
  - **Report.Read.All** or Report.ReadWrite.All  
  - **Dataset.Read.All** or Dataset.ReadWrite.All  
- **Grant admin consent** for your tenant.

---

## 5. Verify

- **Azure token:** `GET /api/test/azure` → `ok: true`.
- **Power BI (report + token):** `GET /api/test/powerbi` → after the steps above, you should get `ok: true` or at least pass the **report** step (no more 500 on Get Report).

This app uses the **Power BI Embedded** REST API and **powerbi-client** / **powerbi-client-react** (not Fabric SDK).
