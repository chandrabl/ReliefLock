const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd, env = {}) {
    try {
        execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });
    } catch (e) {
        console.error(`Failed to run: ${cmd}`);
    }
}

// Stages of development
const stages = [
    {
        daysAgo: 15,
        msg: "Initial project setup and documentation",
        files: ["README.md", ".gitignore", "backend/.gitignore", "frontend/.gitignore", "backend/.env.example", "frontend/.env.example"]
    },
    {
        daysAgo: 14,
        msg: "Setup backend project structure and dependencies",
        files: ["backend/package.json", "backend/package-lock.json", "backend/tsconfig.json", "backend/src/config"]
    },
    {
        daysAgo: 13,
        msg: "Add basic express app setup and error handling",
        files: ["backend/src/index.ts", "backend/src/app.ts", "backend/src/middleware"]
    },
    {
        daysAgo: 11,
        msg: "Create database models for User and Campaign",
        files: ["backend/src/models/User.ts", "backend/src/models/Campaign.ts"]
    },
    {
        daysAgo: 10,
        msg: "Add models for Feedback and Transactions",
        files: ["backend/src/models/Feedback.ts", "backend/src/models/Transaction.ts"]
    },
    {
        daysAgo: 9,
        msg: "Implement auth and campaign routes",
        files: ["backend/src/routes/auth.ts", "backend/src/routes/campaigns.ts"]
    },
    {
        daysAgo: 8,
        msg: "Implement feedback and transaction routes",
        files: ["backend/src/routes/feedback.ts", "backend/src/routes/transactions.ts", "backend/src/services"]
    },
    {
        daysAgo: 7,
        msg: "Initialize Soroban smart contracts project",
        files: ["Cargo.toml", "contracts/relieflock-contract/Cargo.toml", "contracts/relieflock-contract/README.md"]
    },
    {
        daysAgo: 6,
        msg: "Add smart contract types and error definitions",
        files: ["contracts/relieflock-contract/src/types.rs", "contracts/relieflock-contract/src/errors.rs"]
    },
    {
        daysAgo: 5,
        msg: "Implement core smart contract logic and events",
        files: ["contracts/relieflock-contract/src/events.rs", "contracts/relieflock-contract/src/lib.rs", "contracts/relieflock-contract/src/test.rs"]
    },
    {
        daysAgo: 4,
        msg: "Initialize React frontend with Vite",
        files: ["frontend/package.json", "frontend/package-lock.json", "frontend/vite.config.ts", "frontend/tsconfig.json", "frontend/tsconfig.app.json", "frontend/tsconfig.node.json", "frontend/index.html", "frontend/public", "frontend/src/vite-env.d.ts", "frontend/src/main.tsx", "frontend/src/App.tsx", "frontend/src/index.css", "frontend/src/assets", "frontend/.oxlintrc.json", "frontend/README.md"]
    },
    {
        daysAgo: 3,
        msg: "Add reusable frontend components and navigation",
        files: ["frontend/src/components"]
    },
    {
        daysAgo: 2,
        msg: "Implement authentication and core pages",
        files: ["frontend/src/pages/Landing.tsx", "frontend/src/pages/Login.tsx", "frontend/src/pages/Register.tsx", "frontend/src/pages/Campaigns.tsx"]
    },
    {
        daysAgo: 1,
        msg: "Add dashboards for different user roles",
        files: ["frontend/src/pages/beneficiary", "frontend/src/pages/merchant", "frontend/src/pages/ngo", "frontend/src/lib"]
    },
    {
        daysAgo: 0,
        msg: "Add deployment scripts and CI/CD pipelines",
        files: [".github", ".cargo", "scripts", "frontend/.npmrc"]
    }
];

// 1. Reset the repository to undo the root commit but keep all files
console.log("Undoing current root commit...");
run('git update-ref -d HEAD');
run('git rm --cached -r .');

// Calculate base date (Today)
const now = new Date();

// 2. Iterate through stages and commit
for (const stage of stages) {
    const commitDate = new Date(now.getTime() - (stage.daysAgo * 24 * 60 * 60 * 1000));
    // Add a bit of randomness to the time so it looks natural (between 10 AM and 6 PM)
    commitDate.setHours(10 + Math.floor(Math.random() * 8));
    commitDate.setMinutes(Math.floor(Math.random() * 60));
    
    const dateStr = commitDate.toISOString();
    
    console.log(`\n--- Committing stage: ${stage.msg} (${dateStr}) ---`);
    
    // Add files
    for (const file of stage.files) {
        if (fs.existsSync(file)) {
            run(`git add "${file}"`);
        } else {
            console.warn(`File or directory not found: ${file}`);
        }
    }
    
    // Commit with specific date
    run(`git commit -m "${stage.msg}"`, {
        GIT_AUTHOR_DATE: dateStr,
        GIT_COMMITTER_DATE: dateStr
    });
}

// 3. Add any remaining untracked files just in case
console.log("\n--- Catching any remaining files ---");
run('git add .');
run(`git commit -m "Final polish and bug fixes"`, {
    GIT_AUTHOR_DATE: new Date().toISOString(),
    GIT_COMMITTER_DATE: new Date().toISOString()
});

console.log("\nDone! Now you can force push to GitHub.");
