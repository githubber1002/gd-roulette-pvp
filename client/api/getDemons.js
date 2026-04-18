export default async function handler(req, res) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
  
  console.log("Vercel Bridge: Fetching demons from Pointercrate (Native Fetch)...");
  
  try {
    const urls = [
      'https://pointercrate.com/api/v2/demons/listed/?limit=100',
      'https://pointercrate.com/api/v2/demons/listed/?limit=100&after=100',
      'https://pointercrate.com/api/v2/demons/listed/?limit=100&after=200'
    ];

    const responses = await Promise.all(urls.map(url => fetch(url, { headers })));
    const data = await Promise.all(responses.map(r => r.json()));
    
    const allDemons = data.flat();
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    console.log(`Vercel Bridge: Successfully fetched ${allDemons.length} demons.`);
    res.status(200).json(allDemons);
  } catch (error) {
    console.error("Vercel Bridge Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
