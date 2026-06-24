export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    // Use the mnemonic directly instead of numeric ID
    // Also try fetching one row to see the dimension name
    const [r1, r2, r3] = await Promise.all([
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/c2021ts067.data.json?geography=${lsoa}&measures=20100&RecordLimit=5`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/c2021ts062.data.json?geography=${lsoa}&measures=20100&RecordLimit=5`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/c2021ts007a.data.json?geography=${lsoa}&measures=20100&RecordLimit=5`, { headers }),
    ]);

    const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);

    res.status(200).json({
      qualifications: JSON.stringify(j1).slice(0, 500),
      occupations:    JSON.stringify(j2).slice(0, 500),
      age:            JSON.stringify(j3).slice(0, 500),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
