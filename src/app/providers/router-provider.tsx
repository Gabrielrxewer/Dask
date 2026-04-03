import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BoardPage } from "@/pages/board-page";

export function RouterProvider() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
