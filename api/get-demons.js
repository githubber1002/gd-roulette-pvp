export default async function handler(req, res) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
  
  try {
    console.log("Bridge: Fetching Top 100...");
    const response = await fetch('https://pointercrate.com/api/v2/demons/listed/?limit=100', { headers });
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error) {
    console.error("Bridge Crash:", error.message);
    res.status(500).json({ error: error.message });
  }
}
