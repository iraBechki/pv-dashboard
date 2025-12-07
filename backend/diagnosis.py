"""
Diagnosis Engine for PV System Health Monitoring
Analyzes measured data, inverter-reported data, and calculated values
to detect anomalies and generate alerts.
"""

import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class Alert:
    def __init__(self, severity, category, title, message, component=None, value=None, threshold=None):
        self.id = None  # Will be set when saved to DB
        self.timestamp = datetime.now().isoformat()
        self.severity = severity  # INFO, WARNING, ERROR, CRITICAL
        self.category = category  # voltage, current, power, temperature, communication, discrepancy
        self.title = title
        self.message = message
        self.component = component
        self.value = value
        self.threshold = threshold
        self.acknowledged = False
        self.resolved = False
        
    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp,
            'severity': self.severity,
            'category': self.category,
            'title': self.title,
            'message': self.message,
            'component': self.component,
            'value': self.value,
            'threshold': self.threshold,
            'acknowledged': self.acknowledged,
            'resolved': self.resolved
        }

class DiagnosisEngine:
    def __init__(self):
        self.enabled = False
        self.config = {}
        self.thresholds = self.load_default_thresholds()
        self.thresholds = self.load_default_thresholds()
        self.active_alerts = {}  # Key: alert signature, Value: alert_id
        self.sensor_categories = {} # Key: MB ID, Value: category (solar, battery, inverter, etc.)
        
    def load_default_thresholds(self):
        """Load default threshold values (fallback only)"""
        return {
            'voltage': {
                'pv_min': 150,
                'pv_max': 450,
                'battery_min': 42,
                'battery_max': 58,
                'ac_min': 198,
                'ac_max': 264
            },
            'current': {
                'max_pv_current': 30,
                'max_battery_current': 100,
                'max_ac_current': 50
            },
            'power_discrepancy': {
                'max_percentage': 15  # Max % difference between sensor and inverter
            },
            'temperature': {
                'panel_max': 85,
                'ambient_max': 50,
                'ambient_min': -10
            },
            'communication': {
                'min_rssi': -90
            }
        }
    
    def auto_calculate_thresholds(self, config):
        """Auto-calculate thresholds from inverter datasheet values"""
        thresholds = self.load_default_thresholds()
        
        # Calculate PV voltage thresholds from stringVoltage
        if 'stringVoltage' in config and config['stringVoltage']:
            string_v = float(config['stringVoltage'])
            thresholds['voltage']['pv_max'] = string_v * 1.2  # 20% safety margin
            thresholds['voltage']['pv_min'] = string_v * 0.5  # 50% minimum
            logger.info(f"Auto-calculated PV voltage: {thresholds['voltage']['pv_min']}-{thresholds['voltage']['pv_max']}V")
        
        # Calculate PV current threshold from stringCurrent
        if 'stringCurrent' in config and config['stringCurrent']:
            string_i = float(config['stringCurrent'])
            thresholds['current']['max_pv_current'] = string_i * 1.2  # 20% safety factor
            logger.info(f"Auto-calculated max PV current: {thresholds['current']['max_pv_current']}A")
        
        # Calculate battery current from maxDcCurrent
        if 'maxDcCurrent' in config and config['maxDcCurrent']:
            max_dc_i = float(config['maxDcCurrent'])
            thresholds['current']['max_battery_current'] = max_dc_i
            logger.info(f"Set max battery current from inverter spec: {max_dc_i}A")
        
        # Battery voltage thresholds (48V system default)
        if 'storage' in config and 'nominalVoltage' in config['storage']:
            nominal_v = float(config['storage']['nominalVoltage'])
            thresholds['voltage']['battery_min'] = nominal_v * 0.875  # 87.5% of nominal
            thresholds['voltage']['battery_max'] = nominal_v * 1.208  # 120.8% of nominal
            logger.info(f"Auto-calculated battery voltage: {thresholds['voltage']['battery_min']}-{thresholds['voltage']['battery_max']}V")
        
        return thresholds
    
    def set_config(self, config):
        """Set system configuration from config.json"""
        self.config = config
        
        # Load thresholds from config if available
        if 'thresholds' in config and config['thresholds']:
            logger.info("Loading thresholds from config.json")
            self.thresholds = config['thresholds']
        else:
            # Auto-calculate from inverter datasheet values
            logger.info("Auto-calculating thresholds from inverter datasheet")
            logger.info("Auto-calculating thresholds from inverter datasheet")
            self.thresholds = self.auto_calculate_thresholds(config)

    def set_sensor_categories(self, config):
        """Extract sensor categories from configuration"""
        self.sensor_categories = {}
        
        # 1. From assignments
        if 'assignments' in config:
            for sensor_id, mb_ids in config['assignments'].items():
                # Find category for this sensor_id
                category = "other"
                if 'sensors' in config:
                    for s in config['sensors']:
                        if s['id'] == sensor_id:
                            category = s.get('category', 'other')
                            break
                
                # Assign category to all MBs in this assignment
                for mb_id in mb_ids:
                    self.sensor_categories[mb_id] = category
                    
        # 2. From mbInventory (fallback or override)
        if 'mbInventory' in config:
            for mb in config['mbInventory']:
                # If we can infer category from type or other fields
                pass
                
        logger.info(f"Sensor categories loaded: {self.sensor_categories}")
    def analyze_measurement(self, data, calculations, invd_data):
        """
        Main analysis function called on each measurement
        Returns list of new alerts
        """
        if not self.enabled:
            return []
        
        alerts = []
        
        # 0. NaN/Disconnection checks (highest priority)
        alerts.extend(self.check_nan_values(data))
        
        # 1. Voltage checks
        alerts.extend(self.check_voltages(data, invd_data))
        
        # 2. Current checks
        alerts.extend(self.check_currents(data, invd_data))
        
        # 3. Power discrepancy (sensor vs inverter)
        alerts.extend(self.check_power_discrepancy(calculations, invd_data))
        
        # 4. Temperature checks
        alerts.extend(self.check_temperature(data))
        
        # 5. Communication health
        alerts.extend(self.check_communication(data))
        
        return alerts
    
    def check_nan_values(self, data):
        """Check for NaN values indicating disconnected or failing sensors"""
        alerts = []
        
        for mb_id, fields in data.items():
            nan_count = 0
            total_fields = 0
            nan_fields = []
            
            for field_name, value in fields.items():
                total_fields += 1
                # Check if value is NaN (string "NaN" or actual NaN)
                if value == "NaN" or value == "nan" or (isinstance(value, str) and value.upper() == "NAN"):
                    nan_count += 1
                    nan_fields.append(field_name)
            
            # If all or most fields are NaN, the MB is likely disconnected
            if nan_count > 0:
                if nan_count == total_fields:
                    # All fields are NaN - complete disconnection
                    alerts.append(Alert(
                        severity='CRITICAL',
                        category='communication',
                        title='Measurement Board Disconnected',
                        message=f'Measurement board {mb_id} is completely disconnected - all fields returning NaN',
                        component=mb_id,
                        value=nan_count,
                        threshold=0
                    ))
                else:
                    # Partial NaN - sensor malfunction
                    alerts.append(Alert(
                        severity='ERROR',
                        category='communication',
                        title='Sensor Malfunction',
                        message=f'Measurement board {mb_id} has {nan_count}/{total_fields} fields with NaN values ({", ".join(nan_fields)})',
                        component=mb_id,
                        value=nan_count,
                        threshold=0
                    ))
        
        return alerts
    
    def check_voltages(self, data, invd_data):
        """Check voltage ranges for all components"""
        alerts = []
        
        # Check PV voltages from sensors
        for mb_id, fields in data.items():
            category = self.sensor_categories.get(mb_id, "other")
            logger.info(f"Checking voltages for {mb_id}, category: {category}")
            
            for field_name, value in fields.items():
                # Skip NaN values
                if value == "NaN" or value == "nan" or (isinstance(value, str) and value.upper() == "NAN"):
                    continue
                    
                if field_name.startswith('V') and 'D' in field_name and isinstance(value, (int, float)):
                    # Logic based on category
                    if category == 'solar' or (category == 'other' and value > 100): # Fallback for high voltage likely PV
                        if value > self.thresholds['voltage']['pv_max']:
                            alerts.append(Alert(
                                severity='WARNING',
                                category='voltage',
                                title='High PV Voltage',
                                message=f'PV voltage from {mb_id} ({value:.1f}V) exceeds maximum ({self.thresholds["voltage"]["pv_max"]}V)',
                                component=mb_id,
                                value=value,
                                threshold=self.thresholds['voltage']['pv_max']
                            ))
                        elif value < self.thresholds['voltage']['pv_min'] and value > 10:
                            alerts.append(Alert(
                                severity='WARNING',
                                category='voltage',
                                title='Low PV Voltage',
                                message=f'PV voltage from {mb_id} ({value:.1f}V) below minimum ({self.thresholds["voltage"]["pv_min"]}V)',
                                component=mb_id,
                                value=value,
                                threshold=self.thresholds['voltage']['pv_min']
                            ))
                    
                    elif category == 'battery':
                        if value > self.thresholds['voltage']['battery_max']:
                            alerts.append(Alert(
                                severity='ERROR',
                                category='voltage',
                                title='High Battery Voltage',
                                message=f'Battery voltage from {mb_id} ({value:.1f}V) exceeds maximum ({self.thresholds["voltage"]["battery_max"]}V)',
                                component='battery',  # Use category for UI mapping
                                value=value,
                                threshold=self.thresholds['voltage']['battery_max']
                            ))
                        elif value < self.thresholds['voltage']['battery_min'] and value > 10:
                            alerts.append(Alert(
                                severity='WARNING',
                                category='voltage',
                                title='Low Battery Voltage',
                                message=f'Battery voltage from {mb_id} ({value:.1f}V) below minimum ({self.thresholds["voltage"]["battery_min"]}V)',
                                component='battery',  # Use category for UI mapping
                                value=value,
                                threshold=self.thresholds['voltage']['battery_min']
                            ))
        
        # Check inverter-reported voltages
        if invd_data:
            for pv_num in [1, 2]:
                v_key = f'PV{pv_num}_V'
                if v_key in invd_data:
                    value = invd_data[v_key]
                    if isinstance(value, (int, float)) and value > self.thresholds['voltage']['pv_max']:
                        alerts.append(Alert(
                            severity='WARNING',
                            category='voltage',
                            title=f'High Inverter PV{pv_num} Voltage',
                            message=f'Inverter PV{pv_num} voltage ({value:.1f}V) exceeds maximum ({self.thresholds["voltage"]["pv_max"]}V)',
                            component=f'INVD_PV{pv_num}',
                            value=value,
                            threshold=self.thresholds['voltage']['pv_max']
                        ))
            
            # Battery voltage
            if 'Vbat' in invd_data:
                value = invd_data['Vbat']
                if isinstance(value, (int, float)):
                    if value > self.thresholds['voltage']['battery_max']:
                        alerts.append(Alert(
                            severity='ERROR',
                            category='voltage',
                            title='High Battery Voltage',
                            message=f'Battery voltage ({value:.1f}V) exceeds maximum ({self.thresholds["voltage"]["battery_max"]}V)',
                            component='battery',
                            value=value,
                            threshold=self.thresholds['voltage']['battery_max']
                        ))
                    elif value < self.thresholds['voltage']['battery_min']:
                        alerts.append(Alert(
                            severity='WARNING',
                            category='voltage',
                            title='Low Battery Voltage',
                            message=f'Battery voltage ({value:.1f}V) below minimum ({self.thresholds["voltage"]["battery_min"]}V)',
                            component='battery',
                            value=value,
                            threshold=self.thresholds['voltage']['battery_min']
                        ))
        
        return alerts
    
    def check_currents(self, data, invd_data):
        """Check current values for anomalies"""
        alerts = []
        
        # Check PV currents from sensors
        for mb_id, fields in data.items():
            category = self.sensor_categories.get(mb_id, "other")
            
            for field_name, value in fields.items():
                # Skip NaN values
                if value == "NaN" or value == "nan" or (isinstance(value, str) and value.upper() == "NAN"):
                    continue
                    
                if field_name.startswith('I') and 'D' in field_name and isinstance(value, (int, float)):
                    # Logic based on category
                    if category == 'solar':
                        if value > self.thresholds['current']['max_pv_current']:
                            alerts.append(Alert(
                                severity='WARNING',
                                category='current',
                                title='High PV Current',
                                message=f'PV current from {mb_id} ({value:.1f}A) exceeds maximum ({self.thresholds["current"]["max_pv_current"]}A)',
                                component=mb_id,
                                value=value,
                                threshold=self.thresholds['current']['max_pv_current']
                            ))
                    elif category == 'battery':
                        if value > self.thresholds['current']['max_battery_current']:
                            alerts.append(Alert(
                                severity='WARNING',
                                category='current',
                                title='High Battery Current',
                                message=f'Battery current from {mb_id} ({value:.1f}A) exceeds maximum ({self.thresholds["current"]["max_battery_current"]}A)',
                                component='battery',  # Use category for UI mapping
                                value=value,
                                threshold=self.thresholds['current']['max_battery_current']
                            ))
        
        # Check inverter-reported currents
        if invd_data:
            if 'Ibat' in invd_data:
                value = abs(invd_data['Ibat'])
                if isinstance(value, (int, float)) and value > self.thresholds['current']['max_battery_current']:
                    alerts.append(Alert(
                        severity='ERROR',
                        category='current',
                        title='High Battery Current',
                        message=f'Battery current ({value:.1f}A) exceeds maximum ({self.thresholds["current"]["max_battery_current"]}A)',
                        component='battery',
                        value=value,
                        threshold=self.thresholds['current']['max_battery_current']
                    ))
        
        return alerts
    
    def check_power_discrepancy(self, calculations, invd_data):
        """Compare sensor-measured power vs inverter-reported power"""
        alerts = []
        
        if not calculations or not invd_data:
            return alerts
        
        # PV Power comparison
        sensor_pv_power = calculations.get('total_pv_power', 0)
        invd_pv1_power = invd_data.get('PV1_V', 0) * invd_data.get('PV1_I', 0)
        invd_pv2_power = invd_data.get('PV2_V', 0) * invd_data.get('PV2_I', 0)
        invd_pv_power = invd_pv1_power + invd_pv2_power
        
        if sensor_pv_power > 100 and invd_pv_power > 100:  # Only compare if both have meaningful values
            diff_percentage = abs(sensor_pv_power - invd_pv_power) / max(sensor_pv_power, invd_pv_power) * 100
            
            if diff_percentage > self.thresholds['power_discrepancy']['max_percentage']:
                alerts.append(Alert(
                    severity='WARNING',
                    category='discrepancy',
                    title='PV Power Mismatch',
                    message=f'Sensor PV power ({sensor_pv_power:.0f}W) differs from inverter ({invd_pv_power:.0f}W) by {diff_percentage:.1f}%',
                    component='solar',
                    value=diff_percentage,
                    threshold=self.thresholds['power_discrepancy']['max_percentage']
                ))
        
        # Battery Power comparison
        sensor_battery_power = calculations.get('battery_power', 0)
        invd_battery_power = invd_data.get('Vbat', 0) * invd_data.get('Ibat', 0)
        
        if abs(sensor_battery_power) > 100 and abs(invd_battery_power) > 100:
            diff_percentage = abs(abs(sensor_battery_power) - abs(invd_battery_power)) / max(abs(sensor_battery_power), abs(invd_battery_power)) * 100
            
            if diff_percentage > self.thresholds['power_discrepancy']['max_percentage']:
                alerts.append(Alert(
                    severity='INFO',
                    category='discrepancy',
                    title='Battery Power Mismatch',
                    message=f'Sensor battery power ({sensor_battery_power:.0f}W) differs from inverter ({invd_battery_power:.0f}W) by {diff_percentage:.1f}%',
                    component='battery',
                    value=diff_percentage,
                    threshold=self.thresholds['power_discrepancy']['max_percentage']
                ))
        
        return alerts
    
    def check_temperature(self, data):
        """Check temperature values"""
        alerts = []
        
        for mb_id, fields in data.items():
            # Panel temperature
            if 'T_m' in fields:
                value = fields['T_m']
                if isinstance(value, (int, float)) and value > self.thresholds['temperature']['panel_max']:
                    alerts.append(Alert(
                        severity='WARNING',
                        category='temperature',
                        title='High Panel Temperature',
                        message=f'Panel temperature ({value:.1f}°C) exceeds maximum ({self.thresholds["temperature"]["panel_max"]}°C)',
                        component=mb_id,
                        value=value,
                        threshold=self.thresholds['temperature']['panel_max']
                    ))
            
            # Ambient temperature
            if 'T_amb' in fields:
                value = fields['T_amb']
                if isinstance(value, (int, float)):
                    if value > self.thresholds['temperature']['ambient_max']:
                        alerts.append(Alert(
                            severity='INFO',
                            category='temperature',
                            title='High Ambient Temperature',
                            message=f'Ambient temperature ({value:.1f}°C) is very high',
                            component='environment',
                            value=value,
                            threshold=self.thresholds['temperature']['ambient_max']
                        ))
                    elif value < self.thresholds['temperature']['ambient_min']:
                        alerts.append(Alert(
                            severity='INFO',
                            category='temperature',
                            title='Low Ambient Temperature',
                            message=f'Ambient temperature ({value:.1f}°C) is very low',
                            component='environment',
                            value=value,
                            threshold=self.thresholds['temperature']['ambient_min']
                        ))
        
        return alerts
    
    def check_communication(self, data):
        """Check communication health (RSSI)"""
        alerts = []
        
        for mb_id, fields in data.items():
            if 'Rssi' in fields or 'RSSI' in fields:
                rssi_key = 'Rssi' if 'Rssi' in fields else 'RSSI'
                value = fields[rssi_key]
                if isinstance(value, (int, float)) and value < self.thresholds['communication']['min_rssi']:
                    alerts.append(Alert(
                        severity='WARNING',
                        category='communication',
                        title='Weak Signal Strength',
                        message=f'Measurement board {mb_id} has weak signal (RSSI: {value})',
                        component=mb_id,
                        value=value,
                        threshold=self.thresholds['communication']['min_rssi']
                    ))
        
        return alerts
    
    def get_alert_signature(self, alert):
        """Generate unique signature for alert deduplication"""
        return f"{alert.category}_{alert.component}_{alert.title}"
