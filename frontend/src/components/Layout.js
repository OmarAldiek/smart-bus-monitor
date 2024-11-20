import TopBar from "./TopBar";
import Sidebar from "./Sidebar";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-neutral text-slate-800 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-6">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
