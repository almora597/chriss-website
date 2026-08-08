import os, json, urllib.request

base = os.environ["INTEGRATION_PROXY_URL"]
job_id = "7f905c47-a242-4af8-bb0f-9ba262e342b5"
key = "sk-emergent-0B1D290D090Be4e4dF"
req = urllib.request.Request(
    base + "/stripe/sandboxes",
    data=json.dumps({"job_id": job_id}).encode(),
    headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as r:
    sandbox = json.load(r)
print(json.dumps(sandbox, indent=2))
