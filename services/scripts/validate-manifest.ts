// scripts/validate-manifest.ts
// Run with: npx tsx scripts/validate-manifest.ts

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ResourceManifest {
    version: string;
    resources: Array<{
        uri: string;
        name: string;
        framework: string;
        category: string;
        priority: string;
    }>;
    frameworks: Array<{
        id: string;
        resources: string[];
        sharedResources?: string[];
    }>;
}

async function validateManifest() {
    console.log('🔍 Validating resource manifest...\n');
    
    try {
        // Load manifest
        const manifestPath = path.join(__dirname, '..', 'services', 'resources', 'manifest.json');
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest: ResourceManifest = JSON.parse(manifestContent);
        
        console.log(`📋 Manifest version: ${manifest.version}`);
        console.log(`📄 Total resources: ${manifest.resources.length}`);
        console.log(`🏗️  Total frameworks: ${manifest.frameworks.length}\n`);
        
        // Check each resource file exists
        let existingFiles = 0;
        let missingFiles = 0;
        const missingList: string[] = [];
        
        for (const resource of manifest.resources) {
            const resourcePath = path.join(__dirname, '..', 'services', resource.uri.substring(1));
            
            try {
                await fs.access(resourcePath);
                console.log(`✅ ${resource.uri}`);
                existingFiles++;
            } catch (error) {
                console.log(`❌ ${resource.uri} - FILE NOT FOUND`);
                missingFiles++;
                missingList.push(resource.uri);
            }
        }
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`✅ Existing files: ${existingFiles}`);
        console.log(`❌ Missing files: ${missingFiles}`);
        
        if (missingFiles > 0) {
            console.log(`\n⚠️  Missing files that need to be created:`);
            missingList.forEach(file => console.log(`   - ${file}`));
            
            // Suggest creation commands
            console.log(`\n💡 To create missing files:`);
            missingList.forEach(file => {
                const fullPath = path.join('services', file.substring(1));
                const dir = path.dirname(fullPath);
                console.log(`   mkdir -p ${dir} && touch ${fullPath}`);
            });
        }
        
        // Validate framework resource references
        console.log(`\n🔗 Validating framework resource references:`);
        for (const framework of manifest.frameworks) {
            console.log(`\n📋 ${framework.id}:`);
            
            const allFrameworkResources = [
                ...framework.resources,
                ...(framework.sharedResources || [])
            ];
            
            for (const resourceUri of allFrameworkResources) {
                const resourceExists = manifest.resources.some(r => r.uri === resourceUri);
                if (resourceExists) {
                    console.log(`   ✅ ${resourceUri}`);
                } else {
                    console.log(`   ❌ ${resourceUri} - NOT IN MANIFEST`);
                }
            }
        }
        
        // Category breakdown
        console.log(`\n📂 Resources by category:`);
        const categories = new Map<string, number>();
        for (const resource of manifest.resources) {
            categories.set(resource.category, (categories.get(resource.category) || 0) + 1);
        }
        
        for (const [category, count] of categories.entries()) {
            console.log(`   ${category}: ${count} resources`);
        }
        
        // Priority breakdown
        console.log(`\n⭐ Resources by priority:`);
        const priorities = new Map<string, number>();
        for (const resource of manifest.resources) {
            priorities.set(resource.priority, (priorities.get(resource.priority) || 0) + 1);
        }
        
        for (const [priority, count] of priorities.entries()) {
            console.log(`   ${priority}: ${count} resources`);
        }
        
        console.log(`\n${missingFiles === 0 ? '🎉 All files validated successfully!' : '⚠️  Please create missing files before using the manifest.'}`);
        
    } catch (error) {
        console.error('❌ Error validating manifest:', error);
        process.exit(1);
    }
}

// Run validation
validateManifest().catch(console.error);