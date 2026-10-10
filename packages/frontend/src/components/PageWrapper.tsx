import { motion } from "framer-motion";

interface PageWrapperProperties {
  readonly children: React.ReactNode;
}

export default function PageWrapper({ children }: PageWrapperProperties) {
  return (
    <motion.div animate={{ opacity: 1, x: 0 }} className="w-full h-full flex" exit={{ opacity: 0, x: "-100%" }} initial={{ opacity: 0, x: "100%" }} transition={{ duration: 0.2, ease: "easeIn" }}>
      {children}
    </motion.div>
  );
}
