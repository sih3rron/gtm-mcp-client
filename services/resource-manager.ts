// services/resource-manager.ts
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ResourceManifest {
    version: string;
    lastUpdated: string;
    description: string;
    resources: ResourceEntry[];
    frameworks: FrameworkEntry[];
    categories: Record<string, CategoryInfo>;
    loadingStrategy?: LoadingStrategy;
    validation?: ValidationSettings;
}

interface ResourceEntry {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    category: string;
    framework: string;
    tags: string[];
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedSize: number;
}

interface FrameworkEntry {
    id: string;
    displayName: string;
    description: string;
    version: string;
    category: string;
    resources: string[];
    sharedResources?: string[];
}

interface CategoryInfo {
    description: string;
    priority: string;
    loadOrder: number;
}

interface LoadingStrategy {
    criticalResources: string[];
    lazyLoadResources: string[];
    cacheStrategy: string;
    refreshInterval: number;
}

interface ValidationSettings {
    checkFileExists: boolean;
    validateJsonSchemas: boolean;
    checkResourceReferences: boolean;
    warnOnMissingOptional: boolean;
}

// For compatibility with existing MCP code
interface MCPResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

export class ResourceManager {
    private manifest: ResourceManifest | null = null;
    private manifestPath: string;
    private resourceCache: Map<string, string> = new Map();
    private loadStartTime: number = 0;

    constructor(manifestPath?: string) {
        this.manifestPath = manifestPath || path.join(__dirname, 'resources', 'manifest.json');
    }

    /**
     * Load the resource manifest from disk (cached after first load)
     */
    async loadManifest(): Promise<ResourceManifest> {
        if (this.manifest) {
            return this.manifest;
        }

        this.loadStartTime = Date.now();
        
        try {
            console.log(`📋 Loading resource manifest from: ${this.manifestPath}`);
            const manifestContent = await fs.readFile(this.manifestPath, 'utf8');
            const parsedManifest: ResourceManifest = JSON.parse(manifestContent);
            this.manifest = parsedManifest;
            
            const loadTime = Date.now() - this.loadStartTime;
            console.log(`✅ Loaded resource manifest v${parsedManifest.version} in ${loadTime}ms`);
            console.log(`   📄 ${parsedManifest.resources.length} resources`);
            console.log(`   🏗️  ${parsedManifest.frameworks.length} frameworks`);
            
            return parsedManifest;
        } catch (error) {
            console.error('❌ Failed to load resource manifest:', error);
            
            // Return minimal fallback manifest
            this.manifest = {
                version: '0.0.0-fallback',
                lastUpdated: new Date().toISOString(),
                description: 'Fallback manifest due to load error',
                resources: [],
                frameworks: [],
                categories: {}
            };
            
            return this.manifest;
        }
    }

    /**
     * Get all resources (replaces complex directory scanning)
     */
    async getAllResources(): Promise<ResourceEntry[]> {
        const manifest = await this.loadManifest();
        return manifest.resources;
    }

    /**
     * Get resources for a specific framework
     */
    async getFrameworkResources(frameworkId: string): Promise<ResourceEntry[]> {
        const manifest = await this.loadManifest();
        
        // Get framework info
        const framework = manifest.frameworks.find(f => f.id === frameworkId);
        if (!framework) {
            console.warn(`Framework not found: ${frameworkId}`);
            return [];
        }
        
        // Collect all resources for this framework
        const frameworkUris = [
            ...framework.resources,
            ...(framework.sharedResources || [])
        ];
        
        return manifest.resources.filter(resource => 
            frameworkUris.includes(resource.uri) || resource.framework === frameworkId
        );
    }

    /**
     * Get resources by category (methodology, examples, definitions, etc.)
     */
    async getResourcesByCategory(category: string): Promise<ResourceEntry[]> {
        const manifest = await this.loadManifest();
        return manifest.resources.filter(resource => resource.category === category);
    }

    /**
     * Get resources by tags
     */
    async getResourcesByTags(tags: string[]): Promise<ResourceEntry[]> {
        const manifest = await this.loadManifest();
        return manifest.resources.filter(resource => 
            tags.some(tag => resource.tags.includes(tag))
        );
    }

    /**
     * Get resources by priority
     */
    async getResourcesByPriority(priority: 'critical' | 'high' | 'medium' | 'low'): Promise<ResourceEntry[]> {
        const manifest = await this.loadManifest();
        return manifest.resources.filter(resource => resource.priority === priority);
    }

    /**
     * Get available frameworks
     */
    async getFrameworks(): Promise<FrameworkEntry[]> {
        const manifest = await this.loadManifest();
        return manifest.frameworks;
    }

    /**
     * Find specific resource by URI
     */
    async findResource(uri: string): Promise<ResourceEntry | null> {
        const manifest = await this.loadManifest();
        return manifest.resources.find(resource => resource.uri === uri) || null;
    }

    /**
     * Load actual content of a resource (with caching)
     */
    async getResourceContent(uri: string): Promise<string | null> {
        // Check cache first
        if (this.resourceCache.has(uri)) {
            console.log(`📚 Using cached content for: ${uri}`);
            return this.resourceCache.get(uri)!;
        }

        try {
            // Build file path
            const filePath = path.join(__dirname, uri.substring(1)); // Remove leading /
            console.log(`📖 Loading resource content: ${uri}`);
            
            const content = await fs.readFile(filePath, 'utf8');
            
            // Cache the content
            this.resourceCache.set(uri, content);
            console.log(`✅ Loaded and cached resource: ${uri} (${content.length} chars)`);
            
            return content;
        } catch (error) {
            console.error(`❌ Failed to load resource ${uri}:`, error);
            return null;
        }
    }

    /**
     * Convert to MCP resource format for backwards compatibility
     */
    async getMCPResources(): Promise<MCPResource[]> {
        const manifest = await this.loadManifest();
        return manifest.resources.map(resource => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType
        }));
    }

    /**
     * Get critical resources that should be loaded at startup
     */
    async getCriticalResources(): Promise<ResourceEntry[]> {
        const manifest = await this.loadManifest();
        
        if (manifest.loadingStrategy?.criticalResources) {
            const criticalUris = manifest.loadingStrategy.criticalResources;
            return manifest.resources.filter(resource => 
                criticalUris.includes(resource.uri) || resource.priority === 'critical'
            );
        }
        
        return manifest.resources.filter(resource => resource.priority === 'critical');
    }

    /**
     * Validate manifest integrity
     */
    async validateManifest(): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
        const manifest = await this.loadManifest();
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if all referenced files exist
        for (const resource of manifest.resources) {
            try {
                const filePath = path.join(__dirname, resource.uri.substring(1));
                await fs.access(filePath);
            } catch {
                errors.push(`Resource file not found: ${resource.uri}`);
            }
        }

        // Check framework resource references
        for (const framework of manifest.frameworks) {
            const allFrameworkResources = [
                ...framework.resources,
                ...(framework.sharedResources || [])
            ];
            
            for (const resourceUri of allFrameworkResources) {
                const resourceExists = manifest.resources.some(r => r.uri === resourceUri);
                if (!resourceExists) {
                    errors.push(`Framework ${framework.id} references non-existent resource: ${resourceUri}`);
                }
            }
        }

        // Check for duplicate URIs
        const uris = manifest.resources.map(r => r.uri);
        const duplicates = uris.filter((uri, index) => uris.indexOf(uri) !== index);
        if (duplicates.length > 0) {
            errors.push(`Duplicate resource URIs found: ${duplicates.join(', ')}`);
        }

        // Warnings for best practices
        const criticalCount = manifest.resources.filter(r => r.priority === 'critical').length;
        if (criticalCount === 0) {
            warnings.push('No critical priority resources defined - consider marking essential resources as critical');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get manifest metadata
     */
    async getManifestInfo(): Promise<{ version: string; resourceCount: number; frameworkCount: number; lastUpdated: string }> {
        const manifest = await this.loadManifest();
        return {
            version: manifest.version,
            resourceCount: manifest.resources.length,
            frameworkCount: manifest.frameworks.length,
            lastUpdated: manifest.lastUpdated
        };
    }

    /**
     * Clear resource cache (useful for development)
     */
    clearCache(): void {
        this.resourceCache.clear();
        console.log('🗑️  Resource cache cleared');
    }
}