export default function MCPPage() {
  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <h1 className="page-title">
          MCP Upload Guide
        </h1>
        <p className="page-subtitle">
          1) Rotate PAT in Settings. 2) Build `manifest.json` + `README.md` + `skills_bundle.zip`. 3) Upload via MCP.
        </p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">HTTP Contract</h2>
        <pre className="code-block mt-3">
{`POST /api/v1/mcp/upload
Authorization: Bearer claw_pat_xxx
Content-Type: multipart/form-data
fields:
- manifest.json
- README.md
- skills_bundle`}
        </pre>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">cURL Example</h2>
        <pre className="code-block mt-3">
{`curl -X POST "http://localhost:3000/api/v1/mcp/upload" \\
  -H "Authorization: Bearer claw_pat_xxx" \\
  -F "manifest.json=@manifest.json;type=application/json" \\
  -F "README.md=@README.md;type=text/markdown" \\
  -F "skills_bundle=@skills_bundle.zip;type=application/zip"`}
        </pre>
      </section>
    </div>
  );
}
