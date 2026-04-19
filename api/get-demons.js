export default async function handler(req, res) {
  // Cache the result for 1 hour (3600 seconds) on Vercel's edge network
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    console.log("Bridge: Fetching Top 300 via AllOrigins Proxy...");
    
    const fetchPage = async (after) => {
      const url = `https://pointercrate.com/api/v2/demons/listed/?limit=100${after ? `&after=${after}` : ''}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
      return await response.json();
    };

    // Fetch pages concurrently to save Vercel execution time
    const [page1, page2, page3] = await Promise.all([
      fetchPage(0).catch(() => []),
      fetchPage(100).catch(() => []),
      fetchPage(200).catch(() => [])
    ]);

    let allData = [];
    if (Array.isArray(page1)) allData.push(...page1);
    if (Array.isArray(page2)) allData.push(...page2);
    if (Array.isArray(page3)) allData.push(...page3);

    if (allData.length === 0) {
      throw new Error("Proxy returned no data");
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error("Bridge Crash:", error.message);
    res.status(500).json({ error: error.message });
  }
}
