export default function MCPPage() {
  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <h1 className="page-title">
          Plugin Upload
        </h1>
        <p className="page-subtitle">
          OpenClaw Lodge is the primary publish flow. Use the CLI to pack a workspace locally, then publish it with PAT auth.
        </p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">OpenClaw Lodge Flow</h2>
        <pre className="code-block mt-3">
{`1. Rotate a PAT in Settings
2. Pack a workspace locally
3. Publish the generated bundle to ClawLodge

clawlodge pack --workspace ~/my-workspace
clawlodge publish --workspace ~/my-workspace --origin http://localhost:3001`}
        </pre>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">What OpenClaw Lodge Handles</h2>
        <pre className="code-block mt-3">
{`- scans the allowed workspace files
- auto-builds the publish payload
- redacts common secrets before upload
- extracts skills metadata
- sends the final publish request with your PAT`}
        </pre>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">MCP Compatibility Contract</h2>
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
        <h2 className="panel-title">Raw MCP Upload Example</h2>
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
