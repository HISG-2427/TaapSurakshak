document.addEventListener("DOMContentLoaded", function () {
  const mapElement = document.getElementById("mumbaiHeatmap");

  // Do nothing on pages that do not contain the dashboard map
  if (!mapElement) {
    return;
  }

  // Confirm Leaflet loaded
  if (typeof L === "undefined") {
    console.error("Leaflet failed to load.");
    return;
  }

  const map = L.map("mumbaiHeatmap").setView(
    [19.0760, 72.8777],
    11
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }
  ).addTo(map);

  const heatData = [
    [19.0760, 72.8777, 0.9],
    [19.0178, 72.8478, 0.8],
    [19.0330, 73.0297, 0.7],
    [19.2183, 72.9781, 0.85],
    [19.1197, 72.8468, 0.75],
    [18.9894, 73.1175, 0.65],
    [19.2403, 73.1305, 0.6]
  ];

  if (typeof L.heatLayer === "undefined") {
    console.error("Leaflet.heat failed to load.");
    return;
  }

  L.heatLayer(heatData, {
    radius: 35,
    blur: 25,
    maxZoom: 13,
    max: 1.0
  }).addTo(map);

  // Fixes map sizing issues when the map is inside a Bootstrap card
  setTimeout(function () {
    map.invalidateSize();
  }, 200);
});
const key = '4a3859186dbabdd652e466a270aab3ec';
const ambientTemp = document.getElementById("ambientTemp");

if (ambientTemp) {
  fetch(`https://api.openweathermap.org/data/2.5/weather?q=mumbai&units=metric&appid=${key}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Weather API returned ${response.status}`);
      }
      return response.json();
    })
    .then(json => {
      ambientTemp.innerHTML = `${parseInt(json.main.temp)} <span>°C</span>`;
      ambientTemp.classList.add("text-warning");
    })
    .catch(error => {
      console.error("Unable to load weather data:", error);
      ambientTemp.textContent = "Unavailable";
    });
}