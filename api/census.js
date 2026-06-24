export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    // Nomis Census 2021 correct endpoint format
    const headers = {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    };

    // Fetch all 6 values in parallel using correct Nomis 2021 URL structure
    const [degRes, degTotRes, ageRes, ageTotRes, profRes, profTotRes] = await Promise.all([
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.data.json?geography=${lsoa}&c2021_hiqual_8=7&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.data.json?geography=${lsoa}&c2021_hiqual_8=0&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2078_1.data.json?geography=${lsoa}&c2021_age_92=6,7,8,9,10&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2078_1.data.json?geography=${lsoa}&c2021_age_92=0&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2082_1.data.json?geography=${lsoa}&c_ns_sec_9=2,3&measures=20100`, { headers }),
      fetch(`https://www.nomisweb.co.uk/api/v01/dataset/NM_2082_1.data.json?geography=${lsoa}&c_ns_sec_9=0&measures=20100`, { headers }),
    ]);

    const [degJson, degTotJson, ageJson, ageTotJson, profJson, profTotJson] = await Promise.all([
      degRes.json(), degTotRes.json(),
      ageRes.json(), ageTotRes.json(),
      profRes.json(), profTotRes.json(),
    ]);

    // Return raw so we can see structure
    res.status(200).json({
      degSample: JSON.stringify(degJson).slice(0, 300),
      ageSample: JSON.stringify(ageJson).slice(0, 300),
      profSample: JSON.stringify(profJson).slice(0, 300),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
