
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env relative to this file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

async function getAccessToken(): Promise<string> {
    const url = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID!,
        client_secret: AZURE_CLIENT_SECRET!,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
    });

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to get Azure AD token: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data.access_token;
}

async function createWorkspace(token: string) {
    const url = 'https://api.powerbi.com/v1.0/myorg/groups?workspaceV2=true'; // V2 workspace
    const body = { name: 'ABBCRE_SP_MANAGED_1' };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create workspace via SP: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    console.log('✅ Workspace created successfully!');
    console.log('Workspace ID:', data.id);
    console.log('Workspace Name:', data.name);
    return data.id;
}

async function addUserToWorkspace(token: string, workspaceId: string, email: string) {
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/users`;
    const body = {
        emailAddress: email,
        groupUserAccessRight: 'Admin',
        principalType: 'User',
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`⚠️ Failed to add user ${email}: ${res.status} ${errorText}`);
    } else {
        console.log(`✅ Added User ${email} as Admin!`);
    }
}

async function main() {
    try {
        console.log('--- Creating Workspace as Service Principal ---');
        console.log('Client ID:', AZURE_CLIENT_ID);

        const token = await getAccessToken();
        console.log('Got Access Token via Client Credentials.');

        const workspaceId = await createWorkspace(token);

        // Add Arijit and Sourabh as Admins
        await addUserToWorkspace(token, workspaceId, 'arijit@klizosolutions.com');
        await addUserToWorkspace(token, workspaceId, 'Sourabh@klizosolutions.com');

        console.log('\n🎉 DONE! Please update your .env file with the new Workspace ID:');
        console.log(`POWERBI_WORKSPACE_ID=${workspaceId}`);

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

main();
