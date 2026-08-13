"use client";

import { useState } from "react";
import { vehicleMakes, vehicleModelsByMake } from "@/lib/vehicle/sales-options";
import { AdminField } from "./content-editor";

export function VehicleMakeModelFields({ initialMake = "", initialModel = "" }: { initialMake?: string; initialModel?: string }) {
  const [make, setMake] = useState(initialMake.trim());
  const [model, setModel] = useState(initialModel.trim());
  const models: readonly string[] = vehicleModelsByMake[make as keyof typeof vehicleModelsByMake] || [];
  const knownMake = vehicleMakes.some((option) => same(option, make));
  const knownModel = models.some((option) => same(option, model));

  function changeMake(next: string) {
    setMake(next);
    setModel("");
  }

  return <>
    <AdminField label="Make"><select name="make" required value={make} onChange={(event) => changeMake(event.target.value)}><option value="">Select a make</option>{make && !knownMake && <option value={make}>{make} (current)</option>}{vehicleMakes.map((option) => <option key={option} value={option}>{option}</option>)}</select></AdminField>
    <AdminField label="Model"><select name="model" required value={model} disabled={!make} onChange={(event) => setModel(event.target.value)}><option value="">{make ? "Select a model" : "Select a make first"}</option>{model && !knownModel && <option value={model}>{model} (current)</option>}{models.map((option) => <option key={option} value={option}>{option}</option>)}</select></AdminField>
  </>;
}

function same(left: string, right: string) { return left.toLocaleLowerCase("en-GB") === right.toLocaleLowerCase("en-GB"); }
