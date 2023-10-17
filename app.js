const { once } = require("node:events");
const { DateTime } = require("luxon");
const path = require("path");

const asciichart = require("asciichart");
const fs = require("node:fs");
const getopts = require("getopts");
const readline = require("node:readline");

const modulesNames = ["PokeAPI", "PokeImages", "PokeStats"];
const dateFormat = "dd/MM/yyyy";
const defaultPeriod = 7;
const currentDate = DateTime.now().set({
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0,
});

function APIData(periodLength = 7) {
  this.success = new Array(periodLength).fill(0);
  this.fail = new Array(periodLength).fill(0);
  this.latency = Array.from({ length: periodLength }, (_) => Array());
}

async function scrapDataFromLogs(startDate, periodLength, logsFile) {
  const rl = readline.createInterface({
    input: fs.createReadStream(logsFile),
  });

  const data = {
    PokeStats: new APIData(periodLength),
    PokeAPI: new APIData(periodLength),
    PokeImages: new APIData(periodLength),
  };

  rl.on("line", (line) => {
    const regex =
      /(?<module_name>PokeStats|PokeImages|PokeAPI) \((?<status>success|fail),(?<latency>\d+)ms,(?<date>\d{2}\/\d{2}\/\d{4})\)/;

    const result = regex.exec(line);

    if (result) {
      let { module_name, status, latency, date } = result.groups;

      latency = parseInt(latency);

      // console.log(status, latency, date);
      date = DateTime.fromFormat(date, dateFormat);
      const { days: offSet } = date.diff(startDate, "days").toObject();

      // console.log(
      //   offSet,
      //   startDate.toFormat(dateFormat),
      //   date.toFormat(dateFormat)
      // );

      if (offSet >= 0 && offSet < periodLength) {
        // 3 |4 5 6 7 8 9 10

        data[module_name].latency[offSet].push(latency);
        data[module_name].success[offSet] += status === "success" ? 1 : 0;
        data[module_name].fail[offSet] += status === "fail" ? 1 : 0;
      }
    }
  });

  await once(rl, "close");

  // console.log("listo");
  // console.log(data.PokeAPI);

  return data;
}

async function checkLatency(args) {
  const options = getopts(args, {
    alias: { start: "s", end: "e" },
    default: {
      start: currentDate
        .minus({ days: defaultPeriod - 1 })
        .toFormat(dateFormat),
      end: currentDate.toFormat(dateFormat),
    },
  });

  if (options._.length >= 1) {
    const [moduleName] = options._;

    if (modulesNames.includes(moduleName)) {
      // console.log(options);

      const startDate = DateTime.fromFormat(options.start, dateFormat);
      const endDate = DateTime.fromFormat(options.end, dateFormat);

      if (!startDate.isValid) {
        console.log(
          "Fecha inicio inválida tiene que ser de la forma (02/09/2023)"
        );
        return;
      }

      if (!endDate.isValid) {
        console.log(
          "Fecha fin inválida tiene que ser de la forma (02/09/2023)"
        );
        return;
      }

      const daysDiff = endDate.diff(startDate, "days").toObject().days;

      if (daysDiff < 0) {
        console.log("La fecha inicio es después de la fecha fin");
        return;
      }

      const periodLength = daysDiff + 1;

      const scrappedData = await scrapDataFromLogs(
        startDate,
        periodLength,
        "logs.txt"
      );

      for (let day = 0; day < periodLength; ++day) {
        const latencyOfDay = scrappedData[moduleName].latency[day];

        const averageLatency =
          latencyOfDay.length > 0
            ? (
                latencyOfDay.reduce((prev, curr) => prev + curr, 0) /
                latencyOfDay.length
              )
                .toFixed(2)
                .toString() + "ms"
            : "desconocido";

        console.log(
          startDate.plus({ days: day }).toFormat(dateFormat),
          averageLatency
        );
      }
    } else {
      console.log(
        "Módulo no existe, tiene que ser uno de los siguientes",
        modulesNames.join(", ")
      );
    }
  } else {
    console.log(
      "Módulo no ingresado. Módulos disponibles: ",
      modulesNames.join(", ")
    );
  }
}

async function checkAvailability(args) {
  const options = getopts(args, {
    alias: { LastNthDays: "N" },
    default: {
      LastNthDays: 7,
    },
  });
  // console.log(options);

  let days = options.LastNthDays === true ? 7 : options.LastNthDays;

  if (options.Last3Days) {
    days = 3;
  }

  if (options.Last30Days) {
    days = 30;
  }

  // console.log(days);

  if (options._.length >= 1) {
    const [moduleName] = options._;

    if (modulesNames.includes(moduleName)) {
      // console.log(options);

      const startDate = currentDate.minus({ days: days - 1 });

      const periodLength = days;

      const scrappedData = await scrapDataFromLogs(
        startDate,
        periodLength,
        "logs.txt"
      );

      for (let day = 0; day < periodLength; ++day) {
        const success = scrappedData[moduleName].success[day];
        const fail = scrappedData[moduleName].fail[day];

        const totalRequests = success + fail;

        console.log(
          startDate.plus({ days: day }).toFormat(dateFormat),
          totalRequests === 0 ? "desconocido" : (success / totalRequests) * 100
        );
      }
    } else {
      console.log(
        "Módulo no existe, tiene que ser uno de los siguientes",
        modulesNames.join(", ")
      );
    }
  } else {
    console.log(
      "Módulo no ingresado. Módulos disponibles: ",
      modulesNames.join(", ")
    );
  }
}

async function renderGraph(args) {
  const options = getopts(args, {
    alias: {
      LastNthDays: "N",

      Availability: "V",
      Latency: "L",
    },
    default: {
      LastNthDays: 7,
      Availability: true,
    },
  });
  console.log(options);

  let days = options.LastNthDays === true ? 7 : options.LastNthDays;

  if (options.Last3Days) {
    days = 3;
  }

  if (options.Last30Days) {
    days = 30;
  }

  console.log(days);

  if (options._.length >= 1) {
    const [moduleName] = options._;

    if (modulesNames.includes(moduleName)) {
      // console.log(options);

      const startDate = currentDate.minus({ days: days - 1 });

      const periodLength = days;

      const scrappedData = await scrapDataFromLogs(
        startDate,
        periodLength,
        "logs.txt"
      );

      const averageLatencyByDay = scrappedData[moduleName].latency.map(
        (latencyOfDay) =>
          latencyOfDay.length > 0
            ? parseFloat(
                (
                  latencyOfDay.reduce((prev, curr) => prev + curr, 0) /
                  latencyOfDay.length
                ).toFixed(2)
              )
            : 0
      );

      const graphData = [];
      const n = 4;

      if (options.Latency)
        averageLatencyByDay.forEach((elem) => {
          for (let i = 0; i < n; ++i) {
            graphData.push(elem);
          }
        });
      else
        for (let day = 0; day < periodLength; ++day) {
          const success = scrappedData[moduleName].success[day];
          const fail = scrappedData[moduleName].fail[day];

          const totalRequests = success + fail;
          // console.log(
          //   success,
          //   fail,
          //   (success / totalRequests) * 100,
          //   totalRequests === 0
          // );

          for (let i = 0; i < n; ++i)
            graphData.push(
              totalRequests === 0 ? 0 : (success / totalRequests) * 100
            );
        }

      // console.log(augmentedAverageLatency);
      console.log(asciichart.plot(graphData, { height: 8 }));

      const dates = [];

      for (let i = 0; i < periodLength; ++i) {
        dates.push(startDate.plus({ days: i }));
      }

      //print day
      const ticks = Array(periodLength).fill("┬");
      const daysArray = dates.map(
        (date) =>
          (date.day.toString().length === 1
            ? "0" + date.day.toString()
            : date.day.toString()) + "/"
      );
      const monthsArray = dates.map(
        (date) =>
          (date.month.toString().length === 1
            ? "0" + date.month.toString()
            : date.month.toString()) + "/"
      );
      const yearArray = dates.map((date) => date.year.toString().slice(2));

      const prefix = "             ";

      console.log(prefix + "─" + ticks.join("───"));
      console.log(prefix + daysArray.join(" "));
      console.log(prefix + monthsArray.join(" "));
      console.log(prefix + yearArray.join("  "));
    } else {
      console.log(
        "Módulo no existe, tiene que ser uno de los siguientes",
        modulesNames.join(", ")
      );
    }
  } else {
    console.log(
      "Módulo no ingresado. Módulos disponibles: ",
      modulesNames.join(", ")
    );
  }
}

// scrapDataFromLogs(currentDate.minus({ days: defaultPeriod - 1 }), defaultPeriod, "logs.txt");

// console.log(process.argv);
// fs.readdir(__dirname,(err,files) => console.log(files))
// console.log(path.join(__dirname,'./logs.txt'))
// fs.readFile(path.join(__dirname,'./logs.txt'),(err,data) => {
//   console.log(new TextDecoder().decode(data));

// });
// console.log(__dirname);

function verifyHelp(args) {
  // console.log(args);
  // console.log(getopts(args, { alias: { help: "h" } }));
  return getopts(args, { alias: { help: "h" } }).help ?? false;
}
const [command, ...args] = getopts(process.argv.slice(2), {
  stopEarly: true,
})._;
if (verifyHelp(process.argv.slice(2))) {
  console.log(
    `Este CLI te permite hacer un resumen de un archivo llamado logs.\nTiene los siguientes comandos:\n\n\tCheckAvailability <modulo>\n\tTe permite ver la disponibilidad del <modulo> (PokeAPI,PokeStats,PokeImages)\n\ten un rango especifico de dias\n\n\topciones:\n\n\t--LastNthDays=<numero>,-N <numero>\n\tTe permite ver la disponibilidad de los ultimos <numero> dias\n\n\t--Last3Days (default)\n\tTe permite ver la disponibilidad de los ultimos 3 dias\n\n\t--Last30Days\n\tTe permite ver la disponibilidad de los ultimos 30 dias\n\t\n\n\tCheckLatency <modulo>\n\tTe permite ver la latencia del <modulo> (PokeAPI,PokeStats,PokeImages)\n\ten un rango especifico de dias\n\n\topciones:\n\n\t--start=mm/dd/yyy, -s mm/dd/yyyy (valor default: ${currentDate.minus({days: defaultPeriod - 1}).toFormat(dateFormat)})\n\tDefine la fecha inicio del resumen\n\n\t--end=mm/dd/yyy, -e mm/dd/yyyy (valor default: ${currentDate.toFormat(dateFormat)})\n\tDefine la fecha fin del resumen\n\n\t\n\n\tRenderGraph <modulo>\n\tTe permite ver el grafico de disponibilidad o latencia \n\tdel <modulo> (PokeAPI,PokeStats,PokeImages)\n\ten un rango especifico de dias\n\n\topciones:\n\n\t--Availability,-V (default)\n\tHace que el grafico muestre la disponibilidad\n\n\t--Latency,-L (default)\n\tHace que el grafico muestre la latencia\n\n\t--LastNthDays=<numero>,-N <numero>\n\tTe permite ver el grafico de los ultimos <numero> dias\n\n\t--Last3Days (default)\n\tTe permite ver el grafico en los ultimos 3 dias\n\n\t--Last30Days\n\tTe permite ver el grafico en los ultimos 30 dias\n`
  );
} else
  switch (command) {
    case "CheckLatency":
      checkLatency(args);
      break;
    case "CheckAvailability":
      checkAvailability(args);
      break;
    case "RenderGraph":
      renderGraph(args);
      break;
    default:
      console.log(
        "No existe ese comando. Commandos Disponibles: CheckLatency, CheckAvailability, Render Graph."
      );
  }
