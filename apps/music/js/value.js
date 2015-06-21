'use strict';

var gattValueToJson = function GattValueToJson(type, uuid, value)
{
  var json = {};
  switch (type) {
    case 'characteristic':
      json = gattCharacteristicValueToJson(uuid, value);
      break;
    case 'descriptor':
      json = gattDescriptorValueToJson(uuid, value);
      break;
    default:
      json = { value: value };
      break;
  }
  console.log("json: " + JSON.stringify(json));
  return json;
}

var gattJsonToValue = function GattJsonToValue(type, uuid, json)
{
  var value = null;
  switch (type) {
    case 'characteristic':
      value = gattCharacteristicJsonToValue(uuid, json);
      break;
    case 'descriptor':
      value = gattDescriptorJsonToValue(uuid, json);
      break;
    default:
      value = json.value;
      break;
  }
  console.log("value: " + value);
  return value;
}

// Characteristic
var gattCharacteristicValueToJson = function GattCharacteristicValueToJson(uuid, value)
{
  var json = { value: value };
  switch (uuid) {
    case '00002a37-0000-1000-8000-00805f9b34fb':
      return gattHeartRateMeasurmentCharacteristicValueToJson(value);
    case '00002a38-0000-1000-8000-00805f9b34fb':
      return gattBodySensorLocationCharacteristicValueToJson(value);
    default:
      return json;
  }
  return json;
}

var gattCharacteristicJsonToValue = function GattCharacteristicJsonToValue(uuid, json)
{
  var value = json.value;
  switch (uuid) {
    default:
      return value;
  }
  return value;
}

var gattHeartRateMeasurmentCharacteristicValueToJson = function GattHeartRateMeasurmentCharacteristicValueToJson(value)
{
  var json = { value: value };
  var buffer = new DataView(value);
  var index = 0;
  json.format16 = !!(buffer.getUint8(index) & 0x01);
  json.sensorContactSupported = !!(buffer.getUint8(index) & 0x02);
  json.sensorContactDetected = !!(buffer.getUint8(index) & 0x04);
  json.energyExpendedPresent = !!(buffer.getUint8(index) & 0x08);
  json.rrIntervalPresent = !!(buffer.getUint8(index) & 0x0f);
  index += 1;
  json.heartRateValue = json.format16 ? buffer.getUint16(index) : buffer.getUint8(index);
  index += json.format16 ? 2 : 1;
  json.energyExpendedValue = json.energyExpendedPresent ? buffer.getUint16(index) : 0;
  index += json.energyExpendedPresent ? 2 : 0;
  json.rrIntervalValues = [];
  while (index < buffer.byteLength) {
    json.rrIntervalValues.push(buffer.getUint16(index));
    index += 2;
  }
  return json;
}

var gattBodySensorLocationCharacteristicValueToJson = function GattBodySensorLocationCharacteristicValueToJson(value)
{
  var json = { value: value };
  var buffer = new Uint8Array(value);
  json.position = buffer[0];
  return json;
}

// Descriptor
var gattDescriptorValueToJson = function GattDescriptorValueToJson(uuid, value)
{
  var json = { value: value };
  switch (uuid) {
    case '00002902-0000-1000-8000-00805f9b34fb':
      return gattClientCharacteristicConfigurationDescriptorValueToJson(value);
    default:
      return json;
  }
  return json;
}

var gattDescriptorJsonToValue = function GattDescriptorJsonToValue(uuid, json)
{
  var value = json.value;
  switch (uuid) {
    case '00002902-0000-1000-8000-00805f9b34fb':
      return gattClientCharacteristicConfigurationDescriptorJsonToValue(json);
    default:
      return value;
  }
  return value;
}

var gattClientCharacteristicConfigurationDescriptorValueToJson = function GattClientCharacteristicConfigurationDescriptorValueToJson(value)
{
  var json = { value: value };
  var buffer = new Uint8Array(value);
  json.notification = !!(buffer[0] & 0x0001);
  json.indication = !!(buffer[0] & 0x0002);
  return json;
}

var gattClientCharacteristicConfigurationDescriptorJsonToValue = function gattClientCharacteristicConfigurationDescriptorJsonToValue(json)
{
  var value = json.value;
  value = new ArrayBuffer(2);
  var buffer = new Uint8Array(value);
  if (json.notification) {
    buffer[0] = buffer[0] | 0x0001;
  }
  if (json.indication) {
    buffer[0] = buffer[0] | 0x0002;
  }
  return value;
}
