# IoT Platform — Future Roadmap

## Phase 2 — Production Hardening
- [ ] Redis caching for realtime state (replace in-memory socket rooms)
- [ ] Rate limiting on API and MQTT ingestion
- [ ] Input sanitization and full validation layer (Joi/Zod)
- [ ] Device provisioning via QR code
- [ ] OTA firmware update endpoint
- [ ] MQTT authentication (username/password per device)
- [ ] Webhook alerts on threshold breach

## Phase 3 — Time-Series Optimization
- [ ] InfluxDB integration (migrate sensor_data write path)
- [ ] Automatic data downsampling (keep 1-min averages after 7 days)
- [ ] Grafana dashboard integration via InfluxDB datasource
- [ ] Partition MySQL sensor_data by month

## Phase 4 — Mobile App
- [ ] Flutter client consuming existing REST + WebSocket API
- [ ] Push notifications via FCM when alerts fire
- [ ] Mobile dashboard with same widget system

## Phase 5 — AI & Analytics
- [ ] Anomaly detection pipeline (Python microservice, scikit-learn)
- [ ] Unified data bus: backend → Kafka topic → AI consumer
- [ ] Predictive alerts (e.g. "motor will fail in 48h")
- [ ] YOLO-based CCTV stream analysis (RTSP → inference → event)

## Phase 6 — Multi-Tenant SaaS
- [ ] Organisation / workspace model (one account = N workspaces)
- [ ] Billing integration (Stripe usage-based by device count)
- [ ] Role-based access control (admin, editor, viewer per workspace)
- [ ] White-label dashboard theming per tenant
- [ ] Usage quotas and data retention policies

## Phase 7 — Extended Protocol Support
- [ ] LoRa / LoRaWAN via ChirpStack network server
- [ ] Zigbee gateway integration (Zigbee2MQTT bridge)
- [ ] Modbus TCP/RTU adapter for industrial PLCs
- [ ] CoAP support for constrained devices
- [ ] AMQP support for enterprise IoT

## Phase 8 — Automation Engine
- [ ] Visual rule builder (IF sensor > threshold THEN command)
- [ ] Node-RED integration as automation back-end
- [ ] Scheduled tasks (turn relay off at midnight)
- [ ] Geo-fencing triggers

---

## Architecture Upgrade Path

```
Current (Phase 1):
  MQTT/HTTP/WS → Node.js → MySQL → Socket.IO → React

Phase 3:
  MQTT/HTTP/WS → Node.js → InfluxDB + MySQL → Socket.IO → React
                                ↓
                            Redis cache

Phase 5:
  All ingestion → Kafka → Node.js consumer → InfluxDB
                             ↓
                       Python AI consumer → alert engine

Phase 6 (SaaS):
  Multi-region Node.js cluster → Postgres (tenant metadata)
                                → InfluxDB (time-series, per-tenant bucket)
                                → Redis cluster
```
