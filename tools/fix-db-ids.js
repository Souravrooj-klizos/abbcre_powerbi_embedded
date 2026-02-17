
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Cleaning up old database IDs ---');

    // 1. Delete all user mappings and reports
    await prisma.userReportRole.deleteMany({});
    console.log('Cleared UserReportRole');

    await prisma.powerBIReport.deleteMany({});
    console.log('Cleared PowerBIReport');

    console.log('\n--- Done Cleaning ---');
    console.log('Now please visit http://localhost:3000/api/reports/seed in your browser to re-seed with the correct .env values.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
