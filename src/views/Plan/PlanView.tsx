import { Route, Routes } from "react-router-dom";
import { WeekPlannerView } from "./WeekPlannerView";
import { GroceryListView } from "./GroceryListView";
import "./plan.css";

export default function PlanView() {
  return (
    <Routes>
      <Route index element={<WeekPlannerView />} />
      <Route path="grocery" element={<GroceryListView />} />
    </Routes>
  );
}
