const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();

// 프록시 서버 설정
app.use(
  "/api", // 클라이언트 요청을 프록시할 경로
  createProxyMiddleware({
    target: "https://openapi.koreainvestment.com:9443", // 프록시할 대상 서버 URL
    changeOrigin: true, // 요청의 원본 서버 도메인을 변경
    pathRewrite: {
      "^/api": "/uapi/domestic-stock/v1/ranking/fluctuation", // '/api'를 실제 API 경로로 변경
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        const queryParams = new URL(req.url, `http://${req.headers.host}`)
          .searchParams;
        // console.log("Query Parameters:", queryParams.toString());

        // 필요한 쿼리 파라미터 설정
        const params = {
          fid_input_iscd: queryParams.get("fid_input_iscd") || "",
          fid_rank_sort_cls_code:
            queryParams.get("fid_rank_sort_cls_code") || "",
          fid_rsfl_rate2: queryParams.get("fid_rsfl_rate2") || "",
          fid_cond_mrkt_div_code: "J", // 고정된 값
          fid_cond_scr_div_code: "20170", // 고정된 값
          fid_input_cnt_1: queryParams.get("fid_input_cnt_1") || "",
          fid_prc_cls_code: queryParams.get("fid_prc_cls_code") || "",
          fid_input_price_1: queryParams.get("fid_input_price_1") || "",
          fid_input_price_2: queryParams.get("fid_input_price_2") || "",
          fid_vol_cnt: queryParams.get("fid_vol_cnt") || "",
          fid_trgt_cls_code: queryParams.get("fid_trgt_cls_code") || "",
          fid_trgt_exls_cls_code:
            queryParams.get("fid_trgt_exls_cls_code") || "",
          fid_div_cls_code: queryParams.get("fid_div_cls_code") || "",
          fid_rsfl_rate1: queryParams.get("fid_rsfl_rate1") || "",
        };

        // 파라미터를 쿼리 문자열로 변환
        const queryString = new URLSearchParams(params).toString();
        // console.log("queryString : ", queryString, "\n");

        // 프록시 요청 URL 업데이트
        proxyReq.path = `/uapi/domestic-stock/v1/ranking/fluctuation?${queryString}`;

        // 필요한 헤더 설정
        proxyReq.setHeader(
          "Authorization",
          `Bearer ${process.env.ACCESS_TOKEN}`
        );
        proxyReq.setHeader("Content-Type", "application/json; charset=utf-8");
        proxyReq.setHeader("appKey", process.env.APP_KEY);
        proxyReq.setHeader("appsecret", process.env.APP_SECRET);
        proxyReq.setHeader("tr_id", "FHPST01700000");
      },

      proxyRes: (proxyRes, req, res) => {
        let body = "";

        // 응답 데이터 수신
        proxyRes.on("data", (chunk) => {
          body += chunk;
        });

        proxyRes.on("end", () => {
          console.log("Response Data:", body); // 응답 로그 확인
          try {
            const data = JSON.parse(body);
            console.log(data);
            // 응답 데이터에서 필요한 필드만 추출
            const extractedData = data.output.map((item) => ({
              data_rank: item.data_rank,
              hts_kor_isnm: item.hts_kor_isnm,
              stck_prpr: item.stck_prpr,
              prdy_vrss: item.prdy_vrss,
              prdy_vrss_sign: item.prdy_vrss_sign,
              prdy_ctrt: item.prdy_ctrt,
            }));

            // 클라이언트로 추출된 데이터 전달
            res.json(extractedData);
            console.log("Extracted Data:", extractedData);
          } catch (e) {
            console.error("Error parsing JSON response:", e);
            res.status(500).send("Internal Server Error");
          }
        });
      },
    },
  })
);

// 서버 시작
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
