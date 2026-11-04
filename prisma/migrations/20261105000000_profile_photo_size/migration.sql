-- Profile photo size, so the portfolio can show a whole (tall or wide) photo at its own shape.
ALTER TABLE "ProfilePhoto" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;
