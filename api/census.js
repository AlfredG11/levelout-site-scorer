export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    // Try different parameter variations for TS067
    const [a, b, c, d] = await Promise.all([
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.data.json?geography=${lsoa}&c2021_hiqual_8=7&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.data.json?geography=${lsoa}&c2021_hiqual_8=8&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.data.json?geography=${lsoa}&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.def.sdmx.json`, { headers }),
    ]);

    const [aj, bj, cj, dj] = await Promise.all([a.json(), b.json(), c.json(), d.json()]);

    res.status(200).json({
      param7: aj.error || JSON.stringify(aj.obs || aj.noobs || 'no obs').slice(0, 200),
      param8: bj.error || JSON.stringify(bj.obs || bj.noobs || 'no obs').slice(0, 200),
      allParams: cj.error || JSON.stringify(cj).slice(0, 400),
      definition: JSON.stringify(dj).slice(0, 500),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
