export default async function handler(req, res) {
  // Cache the result for 1 hour (3600 seconds) on Vercel's edge network
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
    console.log("Bridge: Fetching Top 300 Native...");
    
    const fetchPage = async (after) => {
      const url = `https://pointercrate.com/api/v2/demons/listed/?limit=100${after ? `&after=${after}` : ''}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`Pointercrate error: ${response.status}`);
      return await response.json();
    };

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
      throw new Error("No data returned from Pointercrate");
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error("Bridge Crash:", error.message);
    res.status(500).json({ error: error.message });
  }
}
