export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    // Search for the correct Census 2021 dataset IDs
    const searchRes = await fetch(
      `https://www.nomisweb.co.uk/api/v01/dataset/def.sdmx.json?search=*TS067*`,
      { headers }
    );
    const searchJson = await searchRes.json();

    const searchRes2 = await fetch(
      `https://www.nomisweb.co.uk/api/v01/dataset/def.sdmx.json?search=*qualification*2021*`,
      { headers }
    );
    const searchJson2 = await searchRes2.json();

    res.status(200).json({
      ts067search: JSON.stringify(searchJson).slice(0, 600),
      qualSearch: JSON.stringify(searchJson2).slice(0, 600),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
