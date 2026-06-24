export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    // Test with a simpler direct Nomis URL first
    const url = `https://www.nomisweb.co.uk/api/v01/dataset/C2021TS067.data.json?geography=${lsoa}&c2021_hiqual_8=0,7&measures=20100&uid=0x6c8b9a2e3f1d4c7a`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });

    const text = await response.text();
    
    // Return raw text so we can see what Nomis is sending back
    res.status(200).json({ raw: text.slice(0, 500), status: response.status });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
