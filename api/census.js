export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  const base = 'https://www.nomisweb.co.uk/api/v01/dataset';
  const geo = `geography=${lsoa}`;
  const fmt = 'measures=20100&select=geography_name,geography_code,obs_value';

  try {
    const [degRes, degTotalRes, ageRes, ageTotalRes, profRes, profTotalRes] = await Promise.all([
      fetch(`${base}/C2021TS067.data.json?${geo}&c2021_hiqual_8=7&${fmt}`),
      fetch(`${base}/C2021TS067.data.json?${geo}&c2021_hiqual_8=0&${fmt}`),
      fetch(`${base}/C2021TS007A.data.json?${geo}&c2021_age_92=6,7,8,9,10&${fmt}`),
      fetch(`${base}/C2021TS007A.data.json?${geo}&c2021_age_92=0&${fmt}`),
      fetch(`${base}/C2021TS062.data.json?${geo}&c_ns_sec_9=2,3&${fmt}`),
      fetch(`${base}/C2021TS062.data.json?${geo}&c_ns_sec_9=0&${fmt}`),
    ]);

    const [degJson, degTotalJson, ageJson, ageTotalJson, profJson, profTotalJson] = await Promise.all([
      degRes.json(), degTotalRes.json(),
      ageRes.json(), ageTotalRes.json(),
      profRes.json(), profTotalRes.json(),
    ]);

    const total    = degTotalJson.obs?.[0]?.obs_value || 1;
    const totalAge = ageTotalJson.obs?.[0]?.obs_value || 1;
    const totalProf = profTotalJson.obs?.[0]?.obs_value || 1;

    const degVal  = degJson.obs?.[0]?.obs_value || 0;
    const ageVal  = ageJson.obs?.reduce((s, o) => s + (o.obs_value || 0), 0) || 0;
    const profVal = profJson.obs?.reduce((s, o) => s + (o.obs_value || 0), 0) || 0;

    res.status(200).json({
      deg:  Math.round((degVal  / total)     * 1000) / 10,
      age:  Math.round((ageVal  / totalAge)  * 1000) / 10,
      prof: Math.round((profVal / totalProf) * 1000) / 10,
      lsoa,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
