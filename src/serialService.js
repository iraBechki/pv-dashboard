export async function sendSerialData(config) {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial API not supported in this browser");
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const encoder = new TextEncoder();
    const writer = port.writable.getWriter();

    const dataString = JSON.stringify({
      button1: config.button1 ? 1 : 0,
      button2: config.button2 ? 1 : 0,
      button3: config.button3 ? 1 : 0,
      voltage: parseFloat(config.voltage) || 0,
      current: parseFloat(config.current) || 0,
      frequency: parseFloat(config.frequency) || 0,
      threshold: parseFloat(config.threshold) || 0,
    });

    await writer.write(encoder.encode(dataString + "\n"));

    writer.releaseLock();
    await port.close();

    console.log("Data sent to serial:", dataString);
    return { success: true };
  } catch (error) {
    console.error("Serial communication error:", error);
    throw error;
  }
}

export async function getAvailablePorts() {
  if (!("serial" in navigator)) {
    return [];
  }
  return await navigator.serial.getPorts();
}
