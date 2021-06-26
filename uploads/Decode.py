from PIL import Image
import numpy as np
import cv2
import math
import os
import sys
import skimage.util
import _pickle as cPickle

name1 = sys.argv[1]
name2 = sys.argv[2]
name3 = sys.argv[3]

y_dct = cPickle.load( open( name1, "rb" ) )
cb_dct = cPickle.load( open( name2, "rb" ) )
cr_dct = cPickle.load( open( name3, "rb" ) )

y_idct = cv2.idct(y_dct)
cb_idct = cv2.idct(cb_dct)
cr_idct = cv2.idct(cr_dct)

res  = cv2.merge((y_idct, cb_idct, cr_idct))
res = np.float32(res)
result = cv2.cvtColor(res, cv2.COLOR_YCR_CB2BGR)

name = sys.argv[1][:-3]
name = "uploads/" + name[14:] + ".jpg"

cv2.imwrite(name, result*255)