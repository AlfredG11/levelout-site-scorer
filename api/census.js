export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    const degRes = await fetch(
      `https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.data.json?geography=${lsoa}&c2021_hiqual_8=7&measures=20100`,
      { headers }
    );

    const degJson = await degRes.json();

    // Return full structure so we can find the obs values
    res.status(200).json({ full: degJson });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
