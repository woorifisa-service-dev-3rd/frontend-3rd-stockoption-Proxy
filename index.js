const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const {
  connectRedis,
  fetchDataFromRedisWithKey,
  saveDataToRedis,
} = require("./redis-client");
require("dotenv").config();

const app = express();

connectRedis();

// 프록시 미들웨어 생성
const proxyMiddleware = createProxyMiddleware({
  target: "https://openapi.koreainvestment.com:9443",
  changeOrigin: true,
  pathRewrite: {
    "^/api": "/uapi/domestic-stock/v1/ranking/fluctuation",
  },
  selfHandleResponse: true, // 응답을 직접 처리하도록 설정 (이거 안하면 proxy로 요청 전달해서 결과값을 바로반환함 (전처리 못해줌))
  on: {
    proxyReq: (proxyReq, req, res) => {
      // console.log("onProxyReq called");
      const queryParams = new URL(req.url, `http://${req.headers.host}`)
        .searchParams;

      proxyReq.setHeader("Authorization", `Bearer ${process.env.ACCESS_TOKEN}`);
      proxyReq.setHeader("Content-Type", "application/json; charset=utf-8");
      proxyReq.setHeader("appKey", process.env.APP_KEY);
      proxyReq.setHeader("appsecret", process.env.APP_SECRET);
      proxyReq.setHeader("tr_id", "FHPST01700000");

      // 필요한 쿼리 파라미터 설정
      const params = {
        fid_input_iscd: queryParams.get("fid_input_iscd") || "",
        fid_rank_sort_cls_code: queryParams.get("fid_rank_sort_cls_code") || "",
        fid_rsfl_rate2: queryParams.get("fid_rsfl_rate2") || "",
        fid_cond_mrkt_div_code: "J",
        fid_cond_scr_div_code: "20170",
        fid_input_cnt_1: queryParams.get("fid_input_cnt_1") || "",
        fid_prc_cls_code: queryParams.get("fid_prc_cls_code") || "",
        fid_input_price_1: queryParams.get("fid_input_price_1") || "",
        fid_input_price_2: queryParams.get("fid_input_price_2") || "",
        fid_vol_cnt: queryParams.get("fid_vol_cnt") || "",
        fid_trgt_cls_code: queryParams.get("fid_trgt_cls_code") || "",
        fid_trgt_exls_cls_code: queryParams.get("fid_trgt_exls_cls_code") || "",
        fid_div_cls_code: queryParams.get("fid_div_cls_code") || "",
        fid_rsfl_rate1: queryParams.get("fid_rsfl_rate1") || "",
      };

      const queryString = new URLSearchParams(params).toString();
      proxyReq.path = `/uapi/domestic-stock/v1/ranking/fluctuation?${queryString}`;
      // console.log("proxyReq.path:", proxyReq.path);
    },
    proxyRes: (proxyRes, req, res) => {
      // console.log("onProxyRes called");
      let body = "";
      proxyRes.on("data", (chunk) => {
        body += chunk;
      });

      proxyRes.on("end", async () => {
        try {
          // console.log("Response body received");
          const data = JSON.parse(body);
          const extractedData = data.output.map((item) => ({
            data_rank: item.data_rank,
            hts_kor_isnm: item.hts_kor_isnm,
            stck_prpr: item.stck_prpr,
            prdy_vrss: item.prdy_vrss,
            prdy_vrss_sign: item.prdy_vrss_sign,
            prdy_ctrt: item.prdy_ctrt,
          }));

          const queryParams = new URL(req.url, `http://${req.headers.host}`)
            .searchParams;
          const redisKey = `api:${queryParams.toString()}`;
          // console.log("Saving to Redis, key:", redisKey);

          await saveDataToRedis(redisKey, JSON.stringify(extractedData));
          res.json(extractedData);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          res.status(500).send("Internal Server Error");
        }
      });
    },
    Error: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).send("Proxy Error");
    },
  },
});

// Redis 체크 및 프록시 미들웨어 적용
app.use("/api", async (req, res, next) => {
  const queryParams = new URL(req.url, `http://${req.headers.host}`)
    .searchParams;
  const redisKey = `api:${queryParams.toString()}`;
  // console.log("Checking Redis for key:", redisKey);

  try {
    const cachedData = await fetchDataFromRedisWithKey(redisKey);
    if (cachedData) {
      console.log("Cache hit! Returning data from Redis.");
      return res.json(JSON.parse(cachedData));
    }

    console.log("Cache miss! Fetching data from API.");
    next();
  } catch (error) {
    console.error("Error accessing Redis:", error);
    next(error);
  }
});

app.use("/api", proxyMiddleware);

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error("Error caught by error handling middleware:", err);
  res.status(500).send("Internal Server Error");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
