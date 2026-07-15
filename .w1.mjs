const auth = "Basic " + Buffer.from("1918e3dbc77a4bd682493538d7031746:").toString("base64");
const res = await fetch("https://api.paylands.com/v1/orders?start=202505010000&end=202507312359&limit=10000", { headers: { Authorization: auth } });
console.log("HTTP", res.status);
const j = await res.json();
console.log("code:", j.code, "| transações:", (j.transactions || []).length);
