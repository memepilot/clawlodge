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
{`1. Install the ClawLodge CLI package
2. Create a PAT in Settings
3. Save it in the CLI
4. Verify the bound account
5. Publish

npm install -g clawlodge-cli
clawlodge login
clawlodge whoami
clawlodge publish`}
        </pre>
        <p className="page-subtitle mt-3">Optional flags: `--name` and `--readme /path/to/README.md`. If you omit README, the server generates it during publish.</p>
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
        <p className="page-subtitle mt-3">For advanced flags such as custom workspace path, output file, token, or origin, run `clawlodge help`.</p>
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
