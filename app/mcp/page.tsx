import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";

export default async function MCPPage() {
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <h1 className="page-title">
          {t.upload.title}
        </h1>
        <p className="page-subtitle">
          {t.upload.subtitle}
        </p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">{t.upload.flowTitle}</h2>
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
        <p className="page-subtitle mt-3">{t.upload.flowNote}</p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">{t.upload.handlesTitle}</h2>
        <pre className="code-block mt-3">
{`- scans the allowed workspace files
- auto-builds the publish payload
- redacts common secrets before upload
- extracts skills metadata
- sends the final publish request with your PAT`}
        </pre>
        <p className="page-subtitle mt-3">{t.upload.handlesNote}</p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">{t.upload.contractTitle}</h2>
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
        <h2 className="panel-title">{t.upload.rawTitle}</h2>
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
