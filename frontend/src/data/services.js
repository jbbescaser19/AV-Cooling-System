import {
  Wrench,
  Sparkles,
  ShieldCheck,
  Settings,
  Clock3,
  Truck,
} from "lucide-react";

export const services = [
  {
    id: "installation",
    name: "Installation",
    desc: "Professional installation with proper placement, drainage, mounting, and testing.",
    icon: Settings,
    tags: ["Residential", "Commercial"],
  },
  {
    id: "cleaning",
    name: "Cleaning & Maintenance",
    desc: "Deep cleaning and preventive maintenance to keep airflow efficient.",
    icon: Sparkles,
    tags: ["Preventive", "Scheduled"],
  },
  {
    id: "repair",
    name: "Repair",
    desc: "Diagnosis and repair for cooling, electrical, drainage, and control issues.",
    icon: Wrench,
    tags: ["Parts", "Repair"],
  },
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    desc: "Systematic inspection to identify faults before unnecessary replacement.",
    icon: ShieldCheck,
    tags: ["Diagnostic", "On-site"],
  },
  {
    id: "relocation",
    name: "Aircon Relocation",
    desc: "Safe dismantling, transfer, and reinstallation of an existing air-conditioning unit.",
    icon: Truck,
    tags: ["Dismantling", "Reinstallation"],
  },
  {
    id: "emergency",
    name: "Emergency Service",
    desc: "Priority support for urgent cooling problems when scheduling permits.",
    icon: Clock3,
    tags: ["Priority", "Fast response"],
  },
];
