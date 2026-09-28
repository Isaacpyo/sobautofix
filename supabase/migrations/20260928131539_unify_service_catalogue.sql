create table public.service_catalogue_systems (
  id uuid primary key default gen_random_uuid(),
  system_key text not null unique check (system_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 600),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_catalogue_systems enable row level security;

create policy "admins manage service catalogue systems"
on public.service_catalogue_systems for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on table public.service_catalogue_systems to authenticated, service_role;

create trigger service_catalogue_systems_updated
before update on public.service_catalogue_systems
for each row execute function public.set_updated_at();

alter table public.booking_service_types
  add column system_id uuid references public.service_catalogue_systems(id) on delete restrict,
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete set null;

create index service_catalogue_systems_active_sort_idx
  on public.service_catalogue_systems (sort_order, display_name)
  where deleted_at is null;
create index booking_service_types_catalogue_sort_idx
  on public.booking_service_types (system_id, sort_order, display_name)
  where deleted_at is null;

insert into public.service_catalogue_systems (system_key, display_name, description, sort_order)
values
  ('diagnostics-electrical', 'Diagnostics & Electrical', 'Systematic testing for warning lights, wiring, networks, modules and vehicle electrical faults.', 10),
  ('engine-management', 'Engine & Engine Management', 'Fault-led assessment of engine management, performance, fuel, air, ignition and mechanical concerns.', 20),
  ('cooling-heating', 'Cooling & Heating', 'Diagnosis and repair support for coolant loss, overheating, cabin heat and cooling-system components.', 30),
  ('emissions-exhaust', 'Emissions & Exhaust', 'Testing for exhaust, emissions-control, DPF, EGR, catalyst and AdBlue/SCR concerns.', 40),
  ('brakes-stability', 'Brakes, ABS & Stability Systems', 'Inspection, diagnosis and repair of braking, ABS, traction and stability-control systems.', 50),
  ('steering-suspension-wheels', 'Steering, Suspension & Wheels', 'Checks and repairs for steering, suspension, wheel bearings, vibration and handling faults.', 60),
  ('transmission-drivetrain', 'Transmission & Drivetrain', 'Assessment of gear selection, clutch, transmission, driveshaft and differential concerns.', 70),
  ('battery-starting-charging', 'Battery, Starting & Charging', 'Battery health, starter, alternator, drive-belt and voltage-drop testing and repair.', 80),
  ('air-conditioning', 'Air Conditioning & Climate Control', 'Diagnosis of air-conditioning, climate-control, compressor, blower and cabin-temperature faults.', 90),
  ('body-electrical', 'Body Electrical & Convenience Systems', 'Electrical fault finding for body-control, doors, windows, mirrors, seats, lighting and instruments.', 100),
  ('safety-driver-assistance', 'Safety & Driver Assistance', 'Assessment of restraint, parking-assistance, camera, TPMS, cruise-control and ADAS warning systems.', 110),
  ('inspection-assessment', 'Inspection & Assessment', 'Independent vehicle checks, diagnostic scans, roadworthiness assessments and second-opinion investigations.', 120),
  ('general-repair-maintenance', 'General Repair & Maintenance', 'Practical servicing, maintenance and general mechanical or electrical repair work.', 130)
on conflict (system_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order;

with seed(system_key, service_key, display_name, description, sort_order, template_key) as (
  values
    ('diagnostics-electrical', 'diagnostics-electrical-vehicle-diagnostic-assessment', 'Vehicle Diagnostic Assessment', 'Vehicle Diagnostic Assessment from the Diagnostics & Electrical service catalogue.', 10, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-warning-light-diagnosis', 'Warning Light Diagnosis', 'Warning Light Diagnosis from the Diagnostics & Electrical service catalogue.', 20, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-check-engine-light-diagnosis', 'Check Engine Light Diagnosis', 'Check Engine Light Diagnosis from the Diagnostics & Electrical service catalogue.', 30, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-electrical-system-diagnosis', 'Electrical System Diagnosis', 'Electrical System Diagnosis from the Diagnostics & Electrical service catalogue.', 40, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-electrical-fault-finding', 'Electrical Fault Finding', 'Electrical Fault Finding from the Diagnostics & Electrical service catalogue.', 50, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-wiring-and-circuit-diagnosis', 'Wiring & Circuit Diagnosis', 'Wiring & Circuit Diagnosis from the Diagnostics & Electrical service catalogue.', 60, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-battery-and-charging-system-diagnosis', 'Battery & Charging System Diagnosis', 'Battery & Charging System Diagnosis from the Diagnostics & Electrical service catalogue.', 70, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-starting-system-diagnosis', 'Starting System Diagnosis', 'Starting System Diagnosis from the Diagnostics & Electrical service catalogue.', 80, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-no-crank-diagnosis', 'No-Crank Diagnosis', 'No-Crank Diagnosis from the Diagnostics & Electrical service catalogue.', 90, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-no-start-diagnosis', 'No-Start Diagnosis', 'No-Start Diagnosis from the Diagnostics & Electrical service catalogue.', 100, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-parasitic-battery-drain-diagnosis', 'Parasitic Battery Drain Diagnosis', 'Parasitic Battery Drain Diagnosis from the Diagnostics & Electrical service catalogue.', 110, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-fuse-and-relay-diagnosis', 'Fuse & Relay Diagnosis', 'Fuse & Relay Diagnosis from the Diagnostics & Electrical service catalogue.', 120, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-can-bus-vehicle-network-diagnosis', 'CAN Bus / Vehicle Network Diagnosis', 'CAN Bus / Vehicle Network Diagnosis from the Diagnostics & Electrical service catalogue.', 130, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-lin-bus-diagnosis', 'LIN Bus Diagnosis', 'LIN Bus Diagnosis from the Diagnostics & Electrical service catalogue.', 140, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-module-communication-diagnosis', 'Module Communication Diagnosis', 'Module Communication Diagnosis from the Diagnostics & Electrical service catalogue.', 150, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-sensor-circuit-diagnosis', 'Sensor Circuit Diagnosis', 'Sensor Circuit Diagnosis from the Diagnostics & Electrical service catalogue.', 160, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-actuator-circuit-diagnosis', 'Actuator Circuit Diagnosis', 'Actuator Circuit Diagnosis from the Diagnostics & Electrical service catalogue.', 170, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-immobiliser-start-authorisation-diagnosis', 'Immobiliser / Start Authorisation Diagnosis', 'Immobiliser / Start Authorisation Diagnosis from the Diagnostics & Electrical service catalogue.', 180, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-lighting-system-diagnosis-and-repair', 'Lighting System Diagnosis & Repair', 'Lighting System Diagnosis & Repair from the Diagnostics & Electrical service catalogue.', 190, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-central-locking-system-diagnosis-and-repair', 'Central Locking System Diagnosis & Repair', 'Central Locking System Diagnosis & Repair from the Diagnostics & Electrical service catalogue.', 200, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-electric-window-system-diagnosis-and-repair', 'Electric Window System Diagnosis & Repair', 'Electric Window System Diagnosis & Repair from the Diagnostics & Electrical service catalogue.', 210, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-wiper-washer-system-diagnosis-and-repair', 'Wiper / Washer System Diagnosis & Repair', 'Wiper / Washer System Diagnosis & Repair from the Diagnostics & Electrical service catalogue.', 220, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-horn-system-diagnosis-and-repair', 'Horn System Diagnosis & Repair', 'Horn System Diagnosis & Repair from the Diagnostics & Electrical service catalogue.', 230, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-parking-sensor-system-diagnosis-and-repair', 'Parking Sensor System Diagnosis & Repair', 'Parking Sensor System Diagnosis & Repair from the Diagnostics & Electrical service catalogue.', 240, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-reversing-camera-system-diagnosis-and-repair', 'Reversing Camera System Diagnosis & Repair', 'Reversing Camera System Diagnosis & Repair from the Diagnostics & Electrical service catalogue.', 250, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-infotainment-radio-system-diagnosis', 'Infotainment / Radio System Diagnosis', 'Infotainment / Radio System Diagnosis from the Diagnostics & Electrical service catalogue.', 260, 'vehicle-diagnostics'),
    ('diagnostics-electrical', 'diagnostics-electrical-accessory-electrical-installation', 'Accessory Electrical Installation', 'Accessory Electrical Installation from the Diagnostics & Electrical service catalogue.', 270, 'vehicle-diagnostics'),
    ('engine-management', 'engine-management-engine-management-system-diagnosis', 'Engine Management System Diagnosis', 'Engine Management System Diagnosis from the Engine & Engine Management service catalogue.', 10, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-engine-performance-diagnosis', 'Engine Performance Diagnosis', 'Engine Performance Diagnosis from the Engine & Engine Management service catalogue.', 20, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-engine-running-fault-diagnosis', 'Engine Running Fault Diagnosis', 'Engine Running Fault Diagnosis from the Engine & Engine Management service catalogue.', 30, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-misfire-diagnosis', 'Misfire Diagnosis', 'Misfire Diagnosis from the Engine & Engine Management service catalogue.', 40, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-rough-running-diagnosis', 'Rough Running Diagnosis', 'Rough Running Diagnosis from the Engine & Engine Management service catalogue.', 50, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-engine-stalling-diagnosis', 'Engine Stalling Diagnosis', 'Engine Stalling Diagnosis from the Engine & Engine Management service catalogue.', 60, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-loss-of-power-diagnosis', 'Loss of Power Diagnosis', 'Loss of Power Diagnosis from the Engine & Engine Management service catalogue.', 70, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-fuel-system-diagnosis', 'Fuel System Diagnosis', 'Fuel System Diagnosis from the Engine & Engine Management service catalogue.', 80, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-low-pressure-fuel-system-diagnosis', 'Low-Pressure Fuel System Diagnosis', 'Low-Pressure Fuel System Diagnosis from the Engine & Engine Management service catalogue.', 90, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-high-pressure-fuel-system-diagnosis', 'High-Pressure Fuel System Diagnosis', 'High-Pressure Fuel System Diagnosis from the Engine & Engine Management service catalogue.', 100, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-fuel-injector-diagnosis', 'Fuel Injector Diagnosis', 'Fuel Injector Diagnosis from the Engine & Engine Management service catalogue.', 110, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-air-intake-system-diagnosis', 'Air Intake System Diagnosis', 'Air Intake System Diagnosis from the Engine & Engine Management service catalogue.', 120, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-maf-map-sensor-diagnosis', 'MAF / MAP Sensor Diagnosis', 'MAF / MAP Sensor Diagnosis from the Engine & Engine Management service catalogue.', 130, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-throttle-system-diagnosis', 'Throttle System Diagnosis', 'Throttle System Diagnosis from the Engine & Engine Management service catalogue.', 140, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-turbocharger-boost-system-diagnosis', 'Turbocharger / Boost System Diagnosis', 'Turbocharger / Boost System Diagnosis from the Engine & Engine Management service catalogue.', 150, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-vacuum-system-diagnosis', 'Vacuum System Diagnosis', 'Vacuum System Diagnosis from the Engine & Engine Management service catalogue.', 160, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-pcv-crankcase-ventilation-diagnosis', 'PCV / Crankcase Ventilation Diagnosis', 'PCV / Crankcase Ventilation Diagnosis from the Engine & Engine Management service catalogue.', 170, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-ignition-system-diagnosis', 'Ignition System Diagnosis', 'Ignition System Diagnosis from the Engine & Engine Management service catalogue.', 180, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-compression-mechanical-engine-assessment', 'Compression / Mechanical Engine Assessment', 'Compression / Mechanical Engine Assessment from the Engine & Engine Management service catalogue.', 190, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-timing-system-assessment', 'Timing System Assessment', 'Timing System Assessment from the Engine & Engine Management service catalogue.', 200, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-engine-oil-leak-diagnosis', 'Engine Oil Leak Diagnosis', 'Engine Oil Leak Diagnosis from the Engine & Engine Management service catalogue.', 210, 'engine-repair-assessment'),
    ('engine-management', 'engine-management-engine-repair', 'Engine Repair', 'Engine Repair from the Engine & Engine Management service catalogue.', 220, 'engine-repair-assessment'),
    ('cooling-heating', 'cooling-heating-cooling-system-diagnosis', 'Cooling System Diagnosis', 'Cooling System Diagnosis from the Cooling & Heating service catalogue.', 10, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-cooling-system-pressure-test', 'Cooling System Pressure Test', 'Cooling System Pressure Test from the Cooling & Heating service catalogue.', 20, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-coolant-leak-diagnosis', 'Coolant Leak Diagnosis', 'Coolant Leak Diagnosis from the Cooling & Heating service catalogue.', 30, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-overheating-diagnosis', 'Overheating Diagnosis', 'Overheating Diagnosis from the Cooling & Heating service catalogue.', 40, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-radiator-diagnosis-and-repair', 'Radiator Diagnosis & Repair', 'Radiator Diagnosis & Repair from the Cooling & Heating service catalogue.', 50, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-thermostat-diagnosis-and-replacement', 'Thermostat Diagnosis & Replacement', 'Thermostat Diagnosis & Replacement from the Cooling & Heating service catalogue.', 60, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-cooling-fan-system-diagnosis', 'Cooling Fan System Diagnosis', 'Cooling Fan System Diagnosis from the Cooling & Heating service catalogue.', 70, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-water-pump-diagnosis-and-replacement', 'Water Pump Diagnosis & Replacement', 'Water Pump Diagnosis & Replacement from the Cooling & Heating service catalogue.', 80, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-coolant-temperature-sensor-diagnosis', 'Coolant Temperature Sensor Diagnosis', 'Coolant Temperature Sensor Diagnosis from the Cooling & Heating service catalogue.', 90, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-heater-system-diagnosis', 'Heater System Diagnosis', 'Heater System Diagnosis from the Cooling & Heating service catalogue.', 100, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-heater-matrix-diagnosis', 'Heater Matrix Diagnosis', 'Heater Matrix Diagnosis from the Cooling & Heating service catalogue.', 110, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-auxiliary-heater-diagnosis', 'Auxiliary Heater Diagnosis', 'Auxiliary Heater Diagnosis from the Cooling & Heating service catalogue.', 120, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-cooling-system-flush', 'Cooling System Flush', 'Cooling System Flush from the Cooling & Heating service catalogue.', 130, 'vehicle-diagnostics'),
    ('cooling-heating', 'cooling-heating-coolant-replacement', 'Coolant Replacement', 'Coolant Replacement from the Cooling & Heating service catalogue.', 140, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-emissions-system-diagnosis', 'Emissions System Diagnosis', 'Emissions System Diagnosis from the Emissions & Exhaust service catalogue.', 10, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-exhaust-system-diagnosis', 'Exhaust System Diagnosis', 'Exhaust System Diagnosis from the Emissions & Exhaust service catalogue.', 20, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-exhaust-leak-diagnosis', 'Exhaust Leak Diagnosis', 'Exhaust Leak Diagnosis from the Emissions & Exhaust service catalogue.', 30, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-exhaust-system-repair', 'Exhaust System Repair', 'Exhaust System Repair from the Emissions & Exhaust service catalogue.', 40, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-dpf-diagnosis', 'DPF Diagnosis', 'DPF Diagnosis from the Emissions & Exhaust service catalogue.', 50, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-dpf-pressure-system-diagnosis', 'DPF Pressure System Diagnosis', 'DPF Pressure System Diagnosis from the Emissions & Exhaust service catalogue.', 60, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-dpf-cleaning-regeneration-assessment', 'DPF Cleaning / Regeneration Assessment', 'DPF Cleaning / Regeneration Assessment from the Emissions & Exhaust service catalogue.', 70, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-egr-system-diagnosis', 'EGR System Diagnosis', 'EGR System Diagnosis from the Emissions & Exhaust service catalogue.', 80, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-oxygen-lambda-sensor-diagnosis', 'Oxygen / Lambda Sensor Diagnosis', 'Oxygen / Lambda Sensor Diagnosis from the Emissions & Exhaust service catalogue.', 90, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-exhaust-gas-temperature-sensor-diagnosis', 'Exhaust Gas Temperature Sensor Diagnosis', 'Exhaust Gas Temperature Sensor Diagnosis from the Emissions & Exhaust service catalogue.', 100, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-catalytic-converter-diagnosis', 'Catalytic Converter Diagnosis', 'Catalytic Converter Diagnosis from the Emissions & Exhaust service catalogue.', 110, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-evap-system-diagnosis', 'EVAP System Diagnosis', 'EVAP System Diagnosis from the Emissions & Exhaust service catalogue.', 120, 'vehicle-diagnostics'),
    ('emissions-exhaust', 'emissions-exhaust-adblue-scr-system-diagnosis', 'AdBlue / SCR System Diagnosis', 'AdBlue / SCR System Diagnosis from the Emissions & Exhaust service catalogue.', 130, 'vehicle-diagnostics'),
    ('brakes-stability', 'brakes-stability-brake-system-inspection', 'Brake System Inspection', 'Brake System Inspection from the Brakes, ABS & Stability Systems service catalogue.', 10, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-brake-system-diagnosis', 'Brake System Diagnosis', 'Brake System Diagnosis from the Brakes, ABS & Stability Systems service catalogue.', 20, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-brake-repair', 'Brake Repair', 'Brake Repair from the Brakes, ABS & Stability Systems service catalogue.', 30, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-brake-pad-replacement', 'Brake Pad Replacement', 'Brake Pad Replacement from the Brakes, ABS & Stability Systems service catalogue.', 40, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-brake-disc-and-pad-replacement', 'Brake Disc & Pad Replacement', 'Brake Disc & Pad Replacement from the Brakes, ABS & Stability Systems service catalogue.', 50, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-brake-caliper-diagnosis-and-repair', 'Brake Caliper Diagnosis & Repair', 'Brake Caliper Diagnosis & Repair from the Brakes, ABS & Stability Systems service catalogue.', 60, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-brake-fluid-inspection-replacement', 'Brake Fluid Inspection / Replacement', 'Brake Fluid Inspection / Replacement from the Brakes, ABS & Stability Systems service catalogue.', 70, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-abs-system-diagnosis', 'ABS System Diagnosis', 'ABS System Diagnosis from the Brakes, ABS & Stability Systems service catalogue.', 80, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-abs-sensor-diagnosis', 'ABS Sensor Diagnosis', 'ABS Sensor Diagnosis from the Brakes, ABS & Stability Systems service catalogue.', 90, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-traction-control-system-diagnosis', 'Traction Control System Diagnosis', 'Traction Control System Diagnosis from the Brakes, ABS & Stability Systems service catalogue.', 100, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-electronic-stability-control-diagnosis', 'Electronic Stability Control Diagnosis', 'Electronic Stability Control Diagnosis from the Brakes, ABS & Stability Systems service catalogue.', 110, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-electronic-parking-brake-diagnosis', 'Electronic Parking Brake Diagnosis', 'Electronic Parking Brake Diagnosis from the Brakes, ABS & Stability Systems service catalogue.', 120, 'brake-repair-assessment'),
    ('brakes-stability', 'brakes-stability-parking-brake-diagnosis-and-repair', 'Parking Brake Diagnosis & Repair', 'Parking Brake Diagnosis & Repair from the Brakes, ABS & Stability Systems service catalogue.', 130, 'brake-repair-assessment'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-steering-system-diagnosis', 'Steering System Diagnosis', 'Steering System Diagnosis from the Steering, Suspension & Wheels service catalogue.', 10, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-power-steering-system-diagnosis', 'Power Steering System Diagnosis', 'Power Steering System Diagnosis from the Steering, Suspension & Wheels service catalogue.', 20, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-suspension-system-inspection', 'Suspension System Inspection', 'Suspension System Inspection from the Steering, Suspension & Wheels service catalogue.', 30, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-suspension-system-diagnosis', 'Suspension System Diagnosis', 'Suspension System Diagnosis from the Steering, Suspension & Wheels service catalogue.', 40, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-suspension-repair', 'Suspension Repair', 'Suspension Repair from the Steering, Suspension & Wheels service catalogue.', 50, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-wheel-bearing-diagnosis', 'Wheel Bearing Diagnosis', 'Wheel Bearing Diagnosis from the Steering, Suspension & Wheels service catalogue.', 60, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-wheel-speed-sensor-diagnosis', 'Wheel Speed Sensor Diagnosis', 'Wheel Speed Sensor Diagnosis from the Steering, Suspension & Wheels service catalogue.', 70, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-tyre-wheel-inspection', 'Tyre / Wheel Inspection', 'Tyre / Wheel Inspection from the Steering, Suspension & Wheels service catalogue.', 80, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-vibration-diagnosis', 'Vibration Diagnosis', 'Vibration Diagnosis from the Steering, Suspension & Wheels service catalogue.', 90, 'vehicle-diagnostics'),
    ('steering-suspension-wheels', 'steering-suspension-wheels-vehicle-pulling-handling-diagnosis', 'Vehicle Pulling / Handling Diagnosis', 'Vehicle Pulling / Handling Diagnosis from the Steering, Suspension & Wheels service catalogue.', 100, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-transmission-system-diagnosis', 'Transmission System Diagnosis', 'Transmission System Diagnosis from the Transmission & Drivetrain service catalogue.', 10, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-automatic-transmission-assessment', 'Automatic Transmission Assessment', 'Automatic Transmission Assessment from the Transmission & Drivetrain service catalogue.', 20, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-manual-transmission-assessment', 'Manual Transmission Assessment', 'Manual Transmission Assessment from the Transmission & Drivetrain service catalogue.', 30, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-gear-selection-fault-diagnosis', 'Gear Selection Fault Diagnosis', 'Gear Selection Fault Diagnosis from the Transmission & Drivetrain service catalogue.', 40, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-clutch-system-diagnosis', 'Clutch System Diagnosis', 'Clutch System Diagnosis from the Transmission & Drivetrain service catalogue.', 50, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-clutch-replacement', 'Clutch Replacement', 'Clutch Replacement from the Transmission & Drivetrain service catalogue.', 60, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-driveshaft-cv-joint-diagnosis', 'Driveshaft / CV Joint Diagnosis', 'Driveshaft / CV Joint Diagnosis from the Transmission & Drivetrain service catalogue.', 70, 'vehicle-diagnostics'),
    ('transmission-drivetrain', 'transmission-drivetrain-differential-drivetrain-diagnosis', 'Differential / Drivetrain Diagnosis', 'Differential / Drivetrain Diagnosis from the Transmission & Drivetrain service catalogue.', 80, 'vehicle-diagnostics'),
    ('battery-starting-charging', 'battery-starting-charging-battery-health-test', 'Battery Health Test', 'Battery Health Test from the Battery, Starting & Charging service catalogue.', 10, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-battery-replacement', 'Battery Replacement', 'Battery Replacement from the Battery, Starting & Charging service catalogue.', 20, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-battery-registration-coding', 'Battery Registration / Coding', 'Battery Registration / Coding from the Battery, Starting & Charging service catalogue.', 30, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-starting-system-diagnosis', 'Starting System Diagnosis', 'Starting System Diagnosis from the Battery, Starting & Charging service catalogue.', 40, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-starter-motor-diagnosis', 'Starter Motor Diagnosis', 'Starter Motor Diagnosis from the Battery, Starting & Charging service catalogue.', 50, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-starter-motor-replacement', 'Starter Motor Replacement', 'Starter Motor Replacement from the Battery, Starting & Charging service catalogue.', 60, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-charging-system-diagnosis', 'Charging System Diagnosis', 'Charging System Diagnosis from the Battery, Starting & Charging service catalogue.', 70, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-alternator-diagnosis', 'Alternator Diagnosis', 'Alternator Diagnosis from the Battery, Starting & Charging service catalogue.', 80, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-alternator-replacement', 'Alternator Replacement', 'Alternator Replacement from the Battery, Starting & Charging service catalogue.', 90, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-drive-belt-inspection-replacement', 'Drive Belt Inspection / Replacement', 'Drive Belt Inspection / Replacement from the Battery, Starting & Charging service catalogue.', 100, 'electrical-fault-finding'),
    ('battery-starting-charging', 'battery-starting-charging-voltage-drop-testing', 'Voltage Drop Testing', 'Voltage Drop Testing from the Battery, Starting & Charging service catalogue.', 110, 'electrical-fault-finding'),
    ('air-conditioning', 'air-conditioning-air-conditioning-system-diagnosis', 'Air Conditioning System Diagnosis', 'Air Conditioning System Diagnosis from the Air Conditioning & Climate Control service catalogue.', 10, 'vehicle-diagnostics'),
    ('air-conditioning', 'air-conditioning-climate-control-system-diagnosis', 'Climate Control System Diagnosis', 'Climate Control System Diagnosis from the Air Conditioning & Climate Control service catalogue.', 20, 'vehicle-diagnostics'),
    ('air-conditioning', 'air-conditioning-a-c-electrical-diagnosis', 'A/C Electrical Diagnosis', 'A/C Electrical Diagnosis from the Air Conditioning & Climate Control service catalogue.', 30, 'vehicle-diagnostics'),
    ('air-conditioning', 'air-conditioning-a-c-pressure-assessment', 'A/C Pressure Assessment', 'A/C Pressure Assessment from the Air Conditioning & Climate Control service catalogue.', 40, 'vehicle-diagnostics'),
    ('air-conditioning', 'air-conditioning-compressor-diagnosis', 'Compressor Diagnosis', 'Compressor Diagnosis from the Air Conditioning & Climate Control service catalogue.', 50, 'vehicle-diagnostics'),
    ('air-conditioning', 'air-conditioning-blower-motor-diagnosis', 'Blower Motor Diagnosis', 'Blower Motor Diagnosis from the Air Conditioning & Climate Control service catalogue.', 60, 'vehicle-diagnostics'),
    ('air-conditioning', 'air-conditioning-cabin-temperature-flap-motor-diagnosis', 'Cabin Temperature / Flap Motor Diagnosis', 'Cabin Temperature / Flap Motor Diagnosis from the Air Conditioning & Climate Control service catalogue.', 70, 'vehicle-diagnostics'),
    ('air-conditioning', 'air-conditioning-heater-and-ventilation-diagnosis', 'Heater & Ventilation Diagnosis', 'Heater & Ventilation Diagnosis from the Air Conditioning & Climate Control service catalogue.', 80, 'vehicle-diagnostics'),
    ('body-electrical', 'body-electrical-body-control-system-diagnosis', 'Body Control System Diagnosis', 'Body Control System Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 10, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-door-electrical-system-diagnosis', 'Door Electrical System Diagnosis', 'Door Electrical System Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 20, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-central-locking-diagnosis', 'Central Locking Diagnosis', 'Central Locking Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 30, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-keyless-entry-system-diagnosis', 'Keyless Entry System Diagnosis', 'Keyless Entry System Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 40, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-electric-window-diagnosis', 'Electric Window Diagnosis', 'Electric Window Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 50, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-electric-mirror-diagnosis', 'Electric Mirror Diagnosis', 'Electric Mirror Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 60, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-seat-electrical-system-diagnosis', 'Seat Electrical System Diagnosis', 'Seat Electrical System Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 70, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-tailgate-boot-electrical-diagnosis', 'Tailgate / Boot Electrical Diagnosis', 'Tailgate / Boot Electrical Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 80, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-fuel-flap-system-diagnosis', 'Fuel Flap System Diagnosis', 'Fuel Flap System Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 90, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-interior-lighting-diagnosis', 'Interior Lighting Diagnosis', 'Interior Lighting Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 100, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-exterior-lighting-diagnosis', 'Exterior Lighting Diagnosis', 'Exterior Lighting Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 110, 'electrical-fault-finding'),
    ('body-electrical', 'body-electrical-instrument-cluster-diagnosis', 'Instrument Cluster Diagnosis', 'Instrument Cluster Diagnosis from the Body Electrical & Convenience Systems service catalogue.', 120, 'electrical-fault-finding'),
    ('safety-driver-assistance', 'safety-driver-assistance-airbag-srs-system-diagnosis', 'Airbag / SRS System Diagnosis', 'Airbag / SRS System Diagnosis from the Safety & Driver Assistance service catalogue.', 10, 'vehicle-diagnostics'),
    ('safety-driver-assistance', 'safety-driver-assistance-seat-belt-system-diagnosis', 'Seat Belt System Diagnosis', 'Seat Belt System Diagnosis from the Safety & Driver Assistance service catalogue.', 20, 'vehicle-diagnostics'),
    ('safety-driver-assistance', 'safety-driver-assistance-parking-assistance-system-diagnosis', 'Parking Assistance System Diagnosis', 'Parking Assistance System Diagnosis from the Safety & Driver Assistance service catalogue.', 30, 'vehicle-diagnostics'),
    ('safety-driver-assistance', 'safety-driver-assistance-parking-sensor-diagnosis', 'Parking Sensor Diagnosis', 'Parking Sensor Diagnosis from the Safety & Driver Assistance service catalogue.', 40, 'vehicle-diagnostics'),
    ('safety-driver-assistance', 'safety-driver-assistance-reversing-camera-diagnosis', 'Reversing Camera Diagnosis', 'Reversing Camera Diagnosis from the Safety & Driver Assistance service catalogue.', 50, 'vehicle-diagnostics'),
    ('safety-driver-assistance', 'safety-driver-assistance-adas-warning-system-assessment', 'ADAS Warning System Assessment', 'ADAS Warning System Assessment from the Safety & Driver Assistance service catalogue.', 60, 'vehicle-diagnostics'),
    ('safety-driver-assistance', 'safety-driver-assistance-tpms-diagnosis', 'TPMS Diagnosis', 'TPMS Diagnosis from the Safety & Driver Assistance service catalogue.', 70, 'vehicle-diagnostics'),
    ('safety-driver-assistance', 'safety-driver-assistance-cruise-control-system-diagnosis', 'Cruise Control System Diagnosis', 'Cruise Control System Diagnosis from the Safety & Driver Assistance service catalogue.', 80, 'vehicle-diagnostics'),
    ('inspection-assessment', 'inspection-assessment-pre-purchase-vehicle-inspection', 'Pre-Purchase Vehicle Inspection', 'Pre-Purchase Vehicle Inspection from the Inspection & Assessment service catalogue.', 10, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-vehicle-health-check', 'Vehicle Health Check', 'Vehicle Health Check from the Inspection & Assessment service catalogue.', 20, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-diagnostic-health-scan', 'Diagnostic Health Scan', 'Diagnostic Health Scan from the Inspection & Assessment service catalogue.', 30, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-used-vehicle-assessment', 'Used Vehicle Assessment', 'Used Vehicle Assessment from the Inspection & Assessment service catalogue.', 40, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-auction-vehicle-inspection', 'Auction Vehicle Inspection', 'Auction Vehicle Inspection from the Inspection & Assessment service catalogue.', 50, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-roadworthiness-test-failure-assessment', 'Roadworthiness Test Failure Assessment', 'Roadworthiness Test Failure Assessment from the Inspection & Assessment service catalogue.', 60, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-roadworthiness-test-advisory-assessment', 'Roadworthiness Test Advisory Assessment', 'Roadworthiness Test Advisory Assessment from the Inspection & Assessment service catalogue.', 70, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-electrical-system-assessment', 'Electrical System Assessment', 'Electrical System Assessment from the Inspection & Assessment service catalogue.', 80, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-mechanical-system-assessment', 'Mechanical System Assessment', 'Mechanical System Assessment from the Inspection & Assessment service catalogue.', 90, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-road-test-and-diagnostic-assessment', 'Road Test & Diagnostic Assessment', 'Road Test & Diagnostic Assessment from the Inspection & Assessment service catalogue.', 100, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-post-repair-verification', 'Post-Repair Verification', 'Post-Repair Verification from the Inspection & Assessment service catalogue.', 110, 'pre-purchase-inspection'),
    ('inspection-assessment', 'inspection-assessment-second-opinion-diagnostic-assessment', 'Second Opinion / Diagnostic Assessment', 'Second Opinion / Diagnostic Assessment from the Inspection & Assessment service catalogue.', 120, 'pre-purchase-inspection'),
    ('general-repair-maintenance', 'general-repair-maintenance-general-mechanical-repair', 'General Mechanical Repair', 'General Mechanical Repair from the General Repair & Maintenance service catalogue.', 10, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-general-electrical-repair', 'General Electrical Repair', 'General Electrical Repair from the General Repair & Maintenance service catalogue.', 20, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-service-and-maintenance', 'Service & Maintenance', 'Service & Maintenance from the General Repair & Maintenance service catalogue.', 30, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-oil-and-filter-service', 'Oil & Filter Service', 'Oil & Filter Service from the General Repair & Maintenance service catalogue.', 40, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-air-filter-replacement', 'Air Filter Replacement', 'Air Filter Replacement from the General Repair & Maintenance service catalogue.', 50, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-cabin-filter-replacement', 'Cabin Filter Replacement', 'Cabin Filter Replacement from the General Repair & Maintenance service catalogue.', 60, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-fuel-filter-replacement', 'Fuel Filter Replacement', 'Fuel Filter Replacement from the General Repair & Maintenance service catalogue.', 70, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-spark-plug-replacement', 'Spark Plug Replacement', 'Spark Plug Replacement from the General Repair & Maintenance service catalogue.', 80, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-glow-plug-diagnosis-replacement', 'Glow Plug Diagnosis / Replacement', 'Glow Plug Diagnosis / Replacement from the General Repair & Maintenance service catalogue.', 90, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-auxiliary-belt-replacement', 'Auxiliary Belt Replacement', 'Auxiliary Belt Replacement from the General Repair & Maintenance service catalogue.', 100, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-bulb-lighting-repair', 'Bulb / Lighting Repair', 'Bulb / Lighting Repair from the General Repair & Maintenance service catalogue.', 110, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-hose-pipe-replacement', 'Hose / Pipe Replacement', 'Hose / Pipe Replacement from the General Repair & Maintenance service catalogue.', 120, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-fluid-leak-diagnosis', 'Fluid Leak Diagnosis', 'Fluid Leak Diagnosis from the General Repair & Maintenance service catalogue.', 130, 'vehicle-servicing'),
    ('general-repair-maintenance', 'general-repair-maintenance-fluid-level-condition-inspection', 'Fluid Level / Condition Inspection', 'Fluid Level / Condition Inspection from the General Repair & Maintenance service catalogue.', 140, 'vehicle-servicing')
)
insert into public.booking_service_types (
  system_id,
  service_key,
  display_name,
  description,
  provider,
  provider_event_type_id,
  online_booking_enabled,
  location_mode,
  sort_order
)
select
  system.id,
  seed.service_key,
  seed.display_name,
  seed.description,
  coalesce(template.provider, 'calcom'),
  template.provider_event_type_id,
  coalesce(template.online_booking_enabled and template.provider_event_type_id is not null, false),
  coalesce(template.location_mode, 'workshop'),
  seed.sort_order
from seed
join public.service_catalogue_systems system on system.system_key = seed.system_key
left join public.booking_service_types template on template.service_key = seed.template_key
on conflict (service_key) do update set
  system_id = excluded.system_id,
  display_name = excluded.display_name,
  description = excluded.description,
  provider = excluded.provider,
  provider_event_type_id = excluded.provider_event_type_id,
  online_booking_enabled = excluded.online_booking_enabled,
  location_mode = excluded.location_mode,
  sort_order = excluded.sort_order,
  deleted_at = null,
  deleted_by = null;

-- Keep the former broad booking choices as historical scheduling templates.
-- Existing bookings retain their foreign keys and snapshots, while customers
-- and invoices see only the categorised service rows seeded above.
update public.booking_service_types
set online_booking_enabled = false,
    deleted_at = coalesce(deleted_at, statement_timestamp())
where system_id is null
  and service_key in (
    'vehicle-diagnostics',
    'electrical-fault-finding',
    'vehicle-servicing',
    'engine-repair-assessment',
    'brake-repair-assessment',
    'mobile-diagnostic-visit',
    'pre-purchase-inspection'
  );

create or replace function public.manage_admin_trash(
  p_entity text,
  p_ids uuid[],
  p_action text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_table text;
  entity_filter text := '';
  affected integer := 0;
  target_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 100 then
    raise exception 'INVALID_TRASH_SELECTION';
  end if;
  if p_action not in ('trash', 'restore', 'delete') then
    raise exception 'INVALID_TRASH_ACTION';
  end if;

  target_table := case p_entity
    when 'enquiries' then 'enquiries'
    when 'bookings' then 'bookings'
    when 'invoices' then 'invoices'
    when 'inventory' then 'sale_vehicles'
    when 'news' then 'content_entries'
    when 'media' then 'media_assets'
    when 'reviews' then 'reviews'
    when 'offers' then 'offers'
    when 'catalogue_systems' then 'service_catalogue_systems'
    when 'catalogue_services' then 'booking_service_types'
    else null
  end;
  if target_table is null then raise exception 'INVALID_TRASH_ENTITY'; end if;
  if p_entity = 'news' then entity_filter := ' and kind = ''article'''; end if;
  if p_entity = 'catalogue_services' then entity_filter := ' and system_id is not null'; end if;

  if p_action = 'trash' then
    execute format('update public.%I set deleted_at = statement_timestamp(), deleted_by = $1 where id = any($2) and deleted_at is null%s', target_table, entity_filter)
      using auth.uid(), p_ids;
    get diagnostics affected = row_count;
    if p_entity = 'catalogue_services' then
      update public.booking_service_types set online_booking_enabled = false where id = any(p_ids);
    elsif p_entity = 'catalogue_systems' then
      update public.booking_service_types set online_booking_enabled = false where system_id = any(p_ids);
    end if;
  elsif p_action = 'restore' then
    execute format('update public.%I set deleted_at = null, deleted_by = null where id = any($1) and deleted_at is not null%s', target_table, entity_filter)
      using p_ids;
    get diagnostics affected = row_count;
  elsif p_entity = 'invoices' then
    foreach target_id in array p_ids loop
      if exists (select 1 from public.invoices where id = target_id and deleted_at is not null and status = 'draft') then
        perform public.delete_invoice_draft(target_id);
        affected := affected + 1;
      end if;
    end loop;
  elsif p_entity = 'bookings' then
    delete from public.bookings booking
    where booking.id = any(p_ids) and booking.deleted_at is not null
      and not exists (select 1 from public.invoices invoice where invoice.booking_id = booking.id);
    get diagnostics affected = row_count;
  elsif p_entity = 'enquiries' then
    delete from public.enquiries enquiry
    where enquiry.id = any(p_ids) and enquiry.deleted_at is not null
      and not exists (select 1 from public.invoices invoice where invoice.enquiry_id = enquiry.id);
    get diagnostics affected = row_count;
  elsif p_entity = 'catalogue_services' then
    delete from public.booking_service_types service
    where service.id = any(p_ids) and service.deleted_at is not null and service.system_id is not null
      and not exists (select 1 from public.bookings booking where booking.service_type_id = service.id);
    get diagnostics affected = row_count;
  elsif p_entity = 'catalogue_systems' then
    delete from public.service_catalogue_systems system
    where system.id = any(p_ids) and system.deleted_at is not null
      and not exists (select 1 from public.booking_service_types service where service.system_id = system.id);
    get diagnostics affected = row_count;
  else
    execute format('delete from public.%I where id = any($1) and deleted_at is not null%s', target_table, entity_filter) using p_ids;
    get diagnostics affected = row_count;
  end if;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'trash.' || p_action, p_entity, coalesce(p_ids[1]::text, 'bulk'), jsonb_build_object('ids', to_jsonb(p_ids), 'affected', affected));
  return affected;
end
$$;

revoke all on function public.manage_admin_trash(text,uuid[],text) from public, anon, authenticated, service_role;
grant execute on function public.manage_admin_trash(text,uuid[],text) to authenticated;
