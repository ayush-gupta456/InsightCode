# REST API

All endpoints use `/api`. Authenticated endpoints require `Authorization: Bearer <access token>`. JSON errors contain `error`. Most input failures return 400; unauthorized access 401; insufficient roles 403; inaccessible resources 404; stale patches 409; limits 413/429.

| Endpoint | Purpose |
|---|---|
| POST /auth/register, /auth/login | Account access; returns user and access token, sets HttpOnly refresh cookie |
| POST /auth/refresh, /auth/logout | Rotate or revoke refresh session |
| GET/PATCH /me | Profile |
| GET/POST /projects | Visible projects / create project; optional teamId explicitly shares it |
| GET/POST /teams | Teams and memberships |
| POST /teams/:id/invitations | Email-bound invitation link |
| POST /teams/accept | Accept token for the signed-in email |
| PATCH/DELETE /teams/:id/members/:userId | Administrator membership management |
| POST /reviews | Submit {name, files:[{path,content}], projectId?, ai?} |
| POST /reviews/zip | Multipart file, name, ai and optional projectId |
| GET /reviews, /reviews/:id | Review list and source snapshot |
| GET /reviews/:id/index | Language, symbols, imports and frameworks |
| PATCH /reviews/:id/findings/:findingId | Set open/dismissed/resolved status |
| POST /reviews/:id/fixes | Preview {file,replacement? ,findingId?} |
| POST /fixes/:id/apply or /revert | Explicit {approved:true} required |
| POST /fixes/:id/validate | Explicit {approved:true}; runs baseline and patched Node tests in containers |
| GET/POST /reviews/:id/messages | Private contextual AI conversation |
| GET /analytics, /usage, /notifications, /audit | Actual stored activity |
| POST /github/review | {owner,repo,ref?,pull?,projectId?,ai?} |
| GET /github/:owner/:repo/branches or /pulls | GitHub reads |
| GET /github/repositories | Connected user's repositories |
| GET /integrations/github | Configuration/connection status |
| POST /integrations/github/connect | OAuth URL; optional privateRepositories/publishing |
| DELETE /integrations/github | Remove local credentials and subscriptions |
| POST /reviews/:id/github/publish | Explicit approved, body, optional findingId; posts externally |
| POST /reviews/:id/github/subscribe | Explicit approved; private automatic re-review |
| POST /github/webhook | Raw body HMAC validation |
| GET /admin | Administrator-only account counts |

Source limits: 200 files, 250 KB per file, 2 MB total. ZIP: 5 MB compressed, bounded expanded size. Review quota: 50 daily submissions and three active jobs per account. No submitted code runs in the API process.
