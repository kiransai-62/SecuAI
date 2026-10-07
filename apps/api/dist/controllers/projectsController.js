"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const supabase_js_1 = require("../db/supabase.js");
const tenant_js_1 = require("../middleware/tenant.js");
class ProjectsController {
    /**
     * GET /api/projects - List projects for the authenticated user
     */
    static async list(req, res) {
        const userId = req.user.id;
        const db = req.supabase;
        if (db) {
            // Per-request Supabase client automatically applies RLS
            const { data, error } = await db
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.json({ projects: data });
            return;
        }
        const projects = Array.from(supabase_js_1.memoryDb.projects.values()).filter(p => p.user_id === userId);
        projects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json({ projects });
    }
    /**
     * POST /api/projects - Create a new project for the authenticated user
     */
    static async create(req, res) {
        const userId = req.user.id;
        const { name, description, source_type = 'ZIP', repository_url, repo_url, framework } = req.body;
        const db = req.supabase;
        const normalizedRepoUrl = repository_url || repo_url || null;
        const newProject = {
            id: crypto.randomUUID(),
            user_id: userId,
            name: name.trim(),
            description: description ? description.trim() : null,
            source_type: source_type || 'ZIP',
            repository_url: normalizedRepoUrl,
            repo_url: normalizedRepoUrl,
            framework: framework ? framework.trim() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        if (db) {
            const { error } = await db.from('projects').insert(newProject);
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
        }
        else {
            supabase_js_1.memoryDb.projects.set(newProject.id, newProject);
        }
        res.status(201).json({ project: newProject });
    }
    /**
     * GET /api/projects/:id - Retrieve project by ID
     * STRICT TENANT RULE: Return 404 (not 403) on other users' projects
     */
    static async getById(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        const db = req.supabase;
        let project = null;
        if (db) {
            const { data } = await db.from('projects').select('*').eq('id', id).maybeSingle();
            project = data;
        }
        else {
            project = supabase_js_1.memoryDb.projects.get(id) || null;
        }
        // STRICT: Return 404 (not 403) if not found or belongs to another user
        if (!(0, tenant_js_1.assertTenantOwnership)(project, userId, res))
            return;
        res.json({ project });
    }
    /**
     * PATCH /api/projects/:id - Update an existing project
     * STRICT TENANT RULE: Return 404 (not 403) on other users' projects
     */
    static async update(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        const db = req.supabase;
        const updates = req.body;
        let existingProject = null;
        if (db) {
            const { data } = await db.from('projects').select('*').eq('id', id).maybeSingle();
            existingProject = data;
        }
        else {
            existingProject = supabase_js_1.memoryDb.projects.get(id) || null;
        }
        // STRICT: Return 404 (not 403) if not found or belongs to another user
        if (!(0, tenant_js_1.assertTenantOwnership)(existingProject, userId, res))
            return;
        const repoUrl = updates.repository_url !== undefined ? updates.repository_url : (updates.repo_url !== undefined ? updates.repo_url : existingProject.repository_url);
        const updatedProject = {
            ...existingProject,
            name: updates.name ? updates.name.trim() : existingProject.name,
            description: updates.description !== undefined ? (updates.description ? updates.description.trim() : null) : existingProject.description,
            source_type: updates.source_type || existingProject.source_type,
            repository_url: repoUrl,
            repo_url: repoUrl,
            framework: updates.framework !== undefined ? (updates.framework ? updates.framework.trim() : null) : existingProject.framework,
            updated_at: new Date().toISOString(),
        };
        if (db) {
            const { error } = await db
                .from('projects')
                .update({
                name: updatedProject.name,
                description: updatedProject.description,
                source_type: updatedProject.source_type,
                repository_url: updatedProject.repository_url,
                repo_url: updatedProject.repo_url,
                framework: updatedProject.framework,
                updated_at: updatedProject.updated_at,
            })
                .eq('id', id);
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
        }
        else {
            supabase_js_1.memoryDb.projects.set(id, updatedProject);
        }
        res.json({ project: updatedProject });
    }
    /**
     * DELETE /api/projects/:id - Delete project
     * STRICT TENANT RULE: Return 404 (not 403) on other users' projects
     */
    static async delete(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        const db = req.supabase;
        let existingProject = null;
        if (db) {
            const { data } = await db.from('projects').select('*').eq('id', id).maybeSingle();
            existingProject = data;
        }
        else {
            existingProject = supabase_js_1.memoryDb.projects.get(id) || null;
        }
        // STRICT: Return 404 (not 403) if not found or belongs to another user
        if (!(0, tenant_js_1.assertTenantOwnership)(existingProject, userId, res))
            return;
        if (db) {
            const { error } = await db.from('projects').delete().eq('id', id);
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
        }
        else {
            supabase_js_1.memoryDb.projects.delete(id);
            // Cascade delete scans and findings in memoryDb
            for (const [scanId, scan] of supabase_js_1.memoryDb.scans.entries()) {
                if (scan.project_id === id)
                    supabase_js_1.memoryDb.scans.delete(scanId);
            }
            for (const [fId, finding] of supabase_js_1.memoryDb.findings.entries()) {
                if (finding.project_id === id)
                    supabase_js_1.memoryDb.findings.delete(fId);
            }
        }
        res.json({ success: true, message: 'Project deleted successfully' });
    }
}
exports.ProjectsController = ProjectsController;
