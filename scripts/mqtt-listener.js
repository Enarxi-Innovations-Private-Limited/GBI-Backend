/**
 * MQTT Telemetry Listener
 * Subscribes to: gbi/devices/+/telemetry
 * Prints incoming messages with timestamp
 */

const mqtt = require("mqtt");

// ===============================
// 🔧 CONFIGURATION (EDIT THIS)
// ===============================
const BROKER_URL = "mqtts://x28f127f.ala.asia-southeast1.emqxsl.com:8883";   // e.g. mqtt://broker.hivemq.com
const USERNAME = "gbi_admin";
const PASSWORD = "Admin@123";

// Subscribe to ALL device IDs using wildcard +
const TOPIC = "gbi/devices/+/telemetry";

// ===============================

const options = {
  username: USERNAME,
  password: PASSWORD,
  reconnectPeriod: 5000, // auto reconnect every 5s
};

console.log("Connecting to MQTT broker...");

const client = mqtt.connect(BROKER_URL, options);

client.on("connect", () => {
  console.log("✅ Connected to broker");

  client.subscribe(TOPIC, (err) => {
    if (err) {
      console.error("❌ Subscription error:", err);
    } else {
      console.log(`📡 Subscribed to topic: ${TOPIC}`);
    }
  });
});

client.on("message", (topic, message) => {
  const receivedAt = new Date().toISOString();

  let parsedMessage;
  try {
    parsedMessage = JSON.parse(message.toString());
  } catch (err) {
    parsedMessage = message.toString(); // fallback if not JSON
  }

  console.log("--------------------------------------------------");
  console.log(`🕒 Timestamp: ${receivedAt}`);
  console.log(`📌 Topic: ${topic}`);
  console.log("📦 Payload:", parsedMessage);
  console.log("--------------------------------------------------\n");
});

client.on("error", (err) => {
  console.error("❌ MQTT Error:", err);
});

client.on("close", () => {
  console.log("⚠️ MQTT connection closed");
});