#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

const char* ssid = "";
const char* password = "";
const char* MQTT_INGEST_KEY = "";

// --- PUBLIC MQTT CONFIGURATION ---
const char* mqttBroker = "broker.hivemq.com";
const int   mqttPort   = 1883;
const char* mqttTopic  = "drukalert/zone/telemetry";

String clientId = "DrukAlert-MultiArray-" + String((uint32_t)ESP.getEfuseMac(), HEX);

WiFiClient  espClient;
PubSubClient mqtt(espClient);

// --- PIN DEFINITIONS FOR MULTI-SENSOR ARRAY ---

// ZONE 1: FLOOD (Ultrasonic 1 + Humidity Sensor 1)
const int floodTrigPin = 5;
const int floodEchoPin = 18;
const int floodDhtPin  = 21;
#define DHTTYPE DHT11
DHT floodDht(floodDhtPin, DHTTYPE);

// ZONE 2: LANDSLIDE (Ultrasonic 2 + Humidity Sensor 2)
const int landTrigPin  = 16;
const int landEchoPin  = 17;
const int landDhtPin   = 22;
DHT landDht(landDhtPin, DHTTYPE);

// ZONE 3: TRESPASSING (Ultrasonic 3 + PIR Motion Sensor)
const int trespassTrigPin = 13;
const int trespassEchoPin = 14;
const int pirPin          = 19;

// Outputs: Alert LED & Master Buzzer
const int alertLedPin     = 23;
const int masterBuzzerPin = 25;

int consecutiveMqttFailures = 0;
const int maxAllowedFailures = 5;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int timeoutCounter = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    timeoutCounter++;
    if (timeoutCounter > 40) {
      Serial.println("\n[!] Wi-Fi connection timeout. Re-attempting stack...");
      WiFi.disconnect();
      WiFi.begin(ssid, password);
      timeoutCounter = 0;
    }
  }

  Serial.println("\nWiFi connected successfully!");
  Serial.print("ESP32 IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Attempting connection to public broker.hivemq.com... ");
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("connected successfully!");
      consecutiveMqttFailures = 0;
    } else {
      int rc = mqtt.state();
      consecutiveMqttFailures++;
      Serial.print("failed, rc=");
      Serial.print(rc);
      Serial.printf(" (Failures: %d/%d)\n", consecutiveMqttFailures, maxAllowedFailures);

      if (consecutiveMqttFailures >= maxAllowedFailures) {
        Serial.println("[!] Maximum MQTT failures reached. Auto-rebooting ESP32...");
        delay(1000);
        ESP.restart();
      }
      delay(3000);
    }
  }
}

float readDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 25000);
  if (duration == 0) return -1;
  return duration * 0.0343 / 2.0;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize Flood Pins
  pinMode(floodTrigPin, OUTPUT);
  pinMode(floodEchoPin, INPUT);
  
  // Initialize Landslide Pins
  pinMode(landTrigPin, OUTPUT);
  pinMode(landEchoPin, INPUT);

  // Initialize Trespassing Pins
  pinMode(trespassTrigPin, OUTPUT);
  pinMode(trespassEchoPin, INPUT);
  pinMode(pirPin, INPUT);

  // Initialize Outputs
  pinMode(alertLedPin, OUTPUT);
  pinMode(masterBuzzerPin, OUTPUT);

  floodDht.begin();
  landDht.begin();
  
  setup_wifi();
  mqtt.setServer(mqttBroker, mqttPort);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setup_wifi();
  }

  if (!mqtt.connected()) {
    reconnectMQTT();
  }
  mqtt.loop();

  // --- READ ZONE 1: FLOOD ---
  float floodDist = readDistance(floodTrigPin, floodEchoPin);
  float floodHum = floodDht.readHumidity();

  // --- READ ZONE 2: LANDSLIDE ---
  float landDist = readDistance(landTrigPin, landEchoPin);
  float landHum = landDht.readHumidity();

  // --- READ ZONE 3: TRESPASSING ---
  float trespassDist = readDistance(trespassTrigPin, trespassEchoPin);
  int motionDetected = digitalRead(pirPin);

  // --- EVALUATE HAZARDS ---
  bool floodAlert = (!isnan(floodHum) && floodHum > 80.0 && floodDist > 0 && floodDist < 40.0);
  bool landslideAlert = (!isnan(landHum) && landHum > 80.0 && landDist > 40.0 && landDist < 120.0);
  bool trespassingAlert = (motionDetected == HIGH || (trespassDist > 0 && trespassDist < 50.0));

  // --- ACTUATORS ---
  if (floodAlert || landslideAlert || trespassingAlert) {
    digitalWrite(alertLedPin, HIGH);
    digitalWrite(masterBuzzerPin, HIGH);
  } else {
    digitalWrite(alertLedPin, LOW);
    digitalWrite(masterBuzzerPin, LOW);
  }

  // --- CONSTRUCT JSON TELEMETRY PAYLOAD ---
  String payload = "{";
  payload += "\"station\":\"TTI Multi-Array Hub\",";
  payload += "\"flood_dist\":" + String(floodDist, 1) + ",";
  payload += "\"flood_hum\":" + String(floodHum, 1) + ",";
  payload += "\"land_dist\":" + String(landDist, 1) + ",";
  payload += "\"land_hum\":" + String(landHum, 1) + ",";
  payload += "\"trespass_dist\":" + String(trespassDist, 1) + ",";
  payload += "\"motion\":" + String(motionDetected) + ",";
  payload += "\"flood_alert\":" + String(floodAlert ? 1 : 0) + ",";
  payload += "\"landslide_alert\":" + String(landslideAlert ? 1 : 0) + ",";
  payload += "\"trespass_alert\":" + String(trespassingAlert ? 1 : 0) + ",";
  payload += "\"key\":\"" + String(MQTT_INGEST_KEY) + "\"";
  payload += "}";

  mqtt.publish(mqttTopic, payload.c_str());
  Serial.printf("[Telemetry Sent] Flood[Dist:%.1f, Hum:%.1f] Land[Dist:%.1f, Hum:%.1f] Trespass[Dist:%.1f, Motion:%d]\n", 
                floodDist, floodHum, landDist, landHum, trespassDist, motionDetected);

  delay(3000);
}