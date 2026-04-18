import axios from 'axios';

export default async function handler(req, res) {
  const config = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  };
  
  console.log("Vercel Bridge: Fetching demons from Pointercrate...");
  
  try {
    const p1 = axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100', config);
    const p2 = axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100&after=100', config);
    const p3 = axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100&after=200', config);
    
    const results = await Promise.all([p1, p2, p3]);
    const allDemons = [...results[0].data, ...results[1].data, ...results[2].data];
    
    // Add CORS headers so the Railway server can talk to this
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    console.log(`Vercel Bridge: Successfully fetched ${allDemons.length} demons.`);
    res.status(200).json(allDemons);
  } catch (error) {
    console.error("Vercel Bridge Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
