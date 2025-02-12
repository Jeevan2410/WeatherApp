

let apiKey = "f8230e5fda9c61f79a851d946c0af8fb";

function updateDOM(data) {
  document.getElementById("city-name").innerHTML = data.city.name;
  let currentTempCelsius = data.list[0].main.temp;
  window.currentTempCelsius = currentTempCelsius;
  document.getElementById("metric").innerHTML = Math.floor(currentTempCelsius) + "°";
  document.getElementById("weather-main").innerHTML = data.list[0].weather[0].description;

  document.getElementById("wind").innerHTML = Math.floor(data.list[0].wind.speed) + " m/s";
  document.getElementById("pressure").innerHTML = Math.floor(data.list[0].main.pressure) + " hPa";
  document.getElementById("humidity-detail").innerHTML = Math.floor(data.list[0].main.humidity) + "%";

  document.getElementById("sunrise").innerHTML = new Date(data.city.sunrise * 1000)
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  document.getElementById("sunset").innerHTML = new Date(data.city.sunset * 1000)
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let weatherCondition = data.list[0].weather[0].main.toLowerCase();
  const weatherIcon = document.querySelector(".weather-icon");
  if (weatherCondition === "rain") {
    weatherIcon.src = "img/rain.png";
  } else if (weatherCondition === "clear" || weatherCondition === "clear sky") {
    weatherIcon.src = "img/sun.png";
  } else if (weatherCondition === "snow") {
    weatherIcon.src = "img/snow.png";
  } else if (weatherCondition === "clouds" || weatherCondition === "smoke") {
    weatherIcon.src = "img/cloud.png";
  } else if (weatherCondition === "mist" || weatherCondition === "fog") {
    weatherIcon.src = "img/mist.png";
  } else if (weatherCondition === "haze") {
    weatherIcon.src = "img/haze.png";
  }
}

async function getWeatherByGeo() {
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        const mapResponse = await fetch(
          `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`
        );
        const mapData = await mapResponse.json();
        const loc = mapData[0].name;

        const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?units=metric&q=${loc}&appid=${apiKey}`;
        const weatherResponse = await fetch(weatherUrl);
        const data = await weatherResponse.json();
        updateDOM(data);
      } catch (error) {
        console.error("An error occurred:", error);
        showErrorPopup("Unable to retrieve weather data.");
      }
    },
    () => {
      alert("Please enable location services and refresh the page.");
    }
  );
}

async function searchWeather(query) {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?units=metric&q=${query}&appid=${apiKey}`
    );
    if (!response.ok) {
      throw new Error("City not found");
    }
    const data = await response.json();
    updateDOM(data);


    document.querySelector(".error-message").style.display = "none";
    document.querySelector(".message").style.display = "none";
  } catch (error) {
    console.error(error);

    showErrorPopup("City not found. Please try again.");
  }
}


function showErrorPopup(message) {
  const popup = document.createElement("div");
  popup.className = "error-popup";
  popup.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
  document.body.appendChild(popup);

 
  setTimeout(() => {
    popup.remove();
  }, 3000);
}

const toggleBtn = document.getElementById("temp-toggle");
let currentUnit = "C";
toggleBtn.addEventListener("click", () => {
  if (currentUnit === "C") {
    let tempF = (window.currentTempCelsius * 9) / 5 + 32;
    document.getElementById("metric").innerHTML = Math.floor(tempF) + "°";
    toggleBtn.innerHTML = "°C";
    currentUnit = "F";
  } else {
    document.getElementById("metric").innerHTML = Math.floor(window.currentTempCelsius) + "°";
    toggleBtn.innerHTML = "°F";
    currentUnit = "C";
  }
});

const searchInput = document.querySelector(".searchinput");
searchInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    const query = searchInput.value;
    if (query.trim() !== "") {
      searchWeather(query);
    }
  }
});

getWeatherByGeo();
