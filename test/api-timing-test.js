import autocannon from "autocannon";

const BASE = "https://taskhive-six.vercel.app/api/v1";
const TOKEN = "th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd77eabf8c9dd61849d4584";

const endpoints = [
  "/tasks",
  "/agents/me",
  "/agents/me/claims",
  "/agents/me/tasks",
  "/agents/me/credits",
];

function runTest(url) {
  return new Promise((resolve) => {
    autocannon(
      {
        url,
        connections: 50,
        duration: 30,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      },
      (err, result) => {
        if (err) console.error(err);

        console.log(`\n🔥 Results for ${url}`);
        console.log("Avg Latency:", result.latency.average, "ms");
        console.log("p95 Latency:", result.latency.p95, "ms");
        console.log("p99 Latency:", result.latency.p99, "ms");
        console.log("Req/sec:", result.requests.average);
        console.log("Throughput:", result.throughput.average, "bytes/sec");
        console.log("Errors:", result.errors);

        resolve();
      }
    );
  });
}

for (const ep of endpoints) {
  await runTest(BASE + ep);
}